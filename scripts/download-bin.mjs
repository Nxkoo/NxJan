// scripts/download.js
import https from 'https'
import fs, { copyFile, mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import unzipper from 'unzipper'
import tar from 'tar'
import { copySync } from 'cpx'

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url} to ${dest}`)
    const file = fs.createWriteStream(dest)
    https
      .get(url, (response) => {
        console.log(`Response status code: ${response.statusCode}`)
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          // Handle redirect
          const redirectURL = response.headers.location
          console.log(`Redirecting to ${redirectURL}`)
          download(redirectURL, dest).then(resolve, reject) // Recursive call
          return
        } else if (response.statusCode !== 200) {
          reject(`Failed to get '${url}' (${response.statusCode})`)
          return
        }
        response.pipe(file)
        file.on('finish', () => {
          file.close(resolve)
        })
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err.message))
      })
  })
}

async function decompress(filePath, targetDir) {
  console.log(`Decompressing ${filePath} to ${targetDir}`)
  if (filePath.endsWith('.zip')) {
    await fs
      .createReadStream(filePath)
      .pipe(unzipper.Extract({ path: targetDir }))
      .promise()
  } else if (filePath.endsWith('.tar.gz')) {
    await tar.x({
      file: filePath,
      cwd: targetDir,
    })
  } else {
    throw new Error(`Unsupported archive format: ${filePath}`)
  }
}

async function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url)
    opts.headers = {
      'User-Agent': 'jan-app',
      'Accept': 'application/vnd.github+json',
      ...headers,
    }
    https
      .get(opts, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return getJson(res.headers.location, headers).then(resolve, reject)
        }
        if (res.statusCode !== 200) {
          reject(new Error(`GET ${url} failed with status ${res.statusCode}`))
          return
        }
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(e)
          }
        })
      })
      .on('error', reject)
  })
}

function matchSqliteVecAsset(assets, platform, arch) {
  const osHints =
    platform === 'darwin'
      ? ['darwin', 'macos', 'apple-darwin']
      : platform === 'win32'
        ? ['windows', 'win', 'msvc']
        : ['linux']

  const archHints = arch === 'arm64' ? ['arm64', 'aarch64'] : ['x86_64', 'x64', 'amd64']
  const extHints = ['zip', 'tar.gz']

  const lc = (s) => s.toLowerCase()
  const candidates = assets
    .filter((a) => a && a.browser_download_url && a.name)
    .map((a) => ({ name: lc(a.name), url: a.browser_download_url }))

  // Prefer exact OS + arch matches
  let matches = candidates.filter((c) => osHints.some((o) => c.name.includes(o)) && archHints.some((h) => c.name.includes(h)) && extHints.some((e) => c.name.endsWith(e)))
  if (matches.length) return matches[0].url
  // Fallback: OS only
  matches = candidates.filter((c) => osHints.some((o) => c.name.includes(o)) && extHints.some((e) => c.name.endsWith(e)))
  if (matches.length) return matches[0].url
  // Last resort: any asset with shared library extension inside is unknown here, so pick any zip/tar.gz
  matches = candidates.filter((c) => extHints.some((e) => c.name.endsWith(e)))
  return matches.length ? matches[0].url : null
}

async function fetchLatestSqliteVecUrl(platform, arch) {
  try {
    const rel = await getJson('https://api.github.com/repos/asg017/sqlite-vec/releases/latest')
    const url = matchSqliteVecAsset(rel.assets || [], platform, arch)
    return url
  } catch (e) {
    console.log('Failed to query sqlite-vec latest release:', e.message)
    return null
  }
}

function getPlatformArch() {
  const platform = os.platform() // 'darwin', 'linux', 'win32'
  const arch = os.arch() // 'x64', 'arm64', etc.

  let bunPlatform, uvPlatform, cbmPlatform

  if (platform === 'darwin') {
    bunPlatform = arch === 'arm64' ? 'darwin-aarch64' : 'darwin-x64'
    uvPlatform =
      arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin'
    // `codebase-memory-mcp` release assets use the `amd64`/`arm64` arch tags
    // (matching the project's own naming), not Rust-style triples.
    cbmPlatform = arch === 'arm64' ? 'darwin-arm64' : 'darwin-amd64'
  } else if (platform === 'linux') {
    bunPlatform = arch === 'arm64' ? 'linux-aarch64' : 'linux-x64'
    uvPlatform =
      arch === 'arm64'
        ? 'aarch64-unknown-linux-gnu'
        : 'x86_64-unknown-linux-gnu'
    cbmPlatform = arch === 'arm64' ? 'linux-arm64' : 'linux-amd64'
  } else if (platform === 'win32') {
    bunPlatform = 'windows-x64' // Bun has limited Windows support
    uvPlatform = 'x86_64-pc-windows-msvc'
    // The project only ships an x86_64 Windows asset. Windows ARM64 hosts
    // (e.g. Snapdragon X Elite) can still run it through x64 emulation, so
    // we ship the same binary for every Windows arch.
    cbmPlatform = 'windows-amd64'
  } else {
    throw new Error(`Unsupported platform: ${platform}`)
  }

  return { bunPlatform, uvPlatform, cbmPlatform }
}

async function main() {
  if (process.env.SKIP_BINARIES) {
    console.log('Skipping binaries download.')
    process.exit(0)
  }
  console.log('Starting main function')
  const platform = os.platform()
  const { bunPlatform, uvPlatform, cbmPlatform } = getPlatformArch()
  console.log(
    `bunPlatform: ${bunPlatform}, uvPlatform: ${uvPlatform}, cbmPlatform: ${cbmPlatform}`
  )

  const binDir = 'src-tauri/resources/bin'
  const tempBinDir = 'scripts/dist'
  const bunPath = `${tempBinDir}/bun-${bunPlatform}.zip`
  let uvPath = `${tempBinDir}/uv-${uvPlatform}.tar.gz`
  if (platform === 'win32') {
    uvPath = `${tempBinDir}/uv-${uvPlatform}.zip`
  }
  // `codebase-memory-mcp` archives: `.tar.gz` on Unix, `.zip` on Windows.
  const cbmArchiveExt = platform === 'win32' ? 'zip' : 'tar.gz'
  const cbmArchiveName = `codebase-memory-mcp-${cbmPlatform}.${cbmArchiveExt}`
  const cbmArchivePath = `${tempBinDir}/${cbmArchiveName}`
  try {
    mkdirSync('scripts/dist')
  } catch (err) {
    // Expect EEXIST error if the directory already exists
  }

  // Adjust these URLs based on latest releases
  const bunUrl = `https://github.com/oven-sh/bun/releases/latest/download/bun-${bunPlatform}.zip`

  let uvUrl = `https://github.com/astral-sh/uv/releases/latest/download/uv-${uvPlatform}.tar.gz`
  if (platform === 'win32') {
    uvUrl = `https://github.com/astral-sh/uv/releases/latest/download/uv-${uvPlatform}.zip`
  }

  console.log(`Downloading Bun for ${bunPlatform}...`)
  const bunSaveDir = path.join(tempBinDir, `bun-${bunPlatform}.zip`)
  if (!fs.existsSync(bunSaveDir)) {
    await download(bunUrl, bunSaveDir)
    await decompress(bunPath, tempBinDir)
  }
  try {
    copySync(
      path.join(tempBinDir, `bun-${bunPlatform}`, 'bun'),
      path.join(binDir)
    )
    fs.chmod(path.join(binDir, 'bun'), 0o755, (err) => {
      if (err) {
        console.log('Add execution permission failed!', err)
      }
    })
    if (platform === 'darwin') {
      copyFile(
        path.join(binDir, 'bun'),
        path.join(binDir, 'bun-x86_64-apple-darwin'),
        (err) => {
          if (err) {
            console.log('Error Found:', err)
          }
        }
      )
      copyFile(
        path.join(binDir, 'bun'),
        path.join(binDir, 'bun-aarch64-apple-darwin'),
        (err) => {
          if (err) {
            console.log('Error Found:', err)
          }
        }
      )
      copyFile(
        path.join(binDir, 'bun'),
        path.join(binDir, 'bun-universal-apple-darwin'),
        (err) => {
          if (err) {
            console.log('Error Found:', err)
          }
        }
      )
    } else if (platform === 'linux') {
      copyFile(
        path.join(binDir, 'bun'),
        path.join(binDir, 'bun-x86_64-unknown-linux-gnu'),
        (err) => {
          if (err) {
            console.log('Error Found:', err)
          }
        }
      )
    }
  } catch (err) {
    // Expect EEXIST error
  }
  try {
    copySync(
      path.join(tempBinDir, `bun-${bunPlatform}`, 'bun.exe'),
      path.join(binDir)
    )
    if (platform === 'win32') {
      copyFile(
        path.join(binDir, 'bun.exe'),
        path.join(binDir, 'bun-x86_64-pc-windows-msvc.exe'),
        (err) => {
          if (err) {
            console.log('Error Found:', err)
          }
        }
      )
    }
  } catch (err) {
    // Expect EEXIST error
  }
  console.log('Bun downloaded.')

  console.log(`Downloading UV for ${uvPlatform}...`)
  const uvExt = platform === 'win32' ? `zip` : `tar.gz`
  const uvSaveDir = path.join(tempBinDir, `uv-${uvPlatform}.${uvExt}`)
  if (!fs.existsSync(uvSaveDir)) {
    await download(uvUrl, uvSaveDir)
    await decompress(uvPath, tempBinDir)
  }
  try {
    copySync(path.join(tempBinDir, `uv-${uvPlatform}`, 'uv'), path.join(binDir))
    fs.chmod(path.join(binDir, 'uv'), 0o755, (err) => {
      if (err) {
        console.log('Add execution permission failed!', err)
      }
    })
    if (platform === 'darwin') {
      copyFile(
        path.join(binDir, 'uv'),
        path.join(binDir, 'uv-x86_64-apple-darwin'),
        (err) => {
          if (err) {
            console.log('Error Found:', err)
          }
        }
      )
      copyFile(
        path.join(binDir, 'uv'),
        path.join(binDir, 'uv-aarch64-apple-darwin'),
        (err) => {
          if (err) {
            console.log('Error Found:', err)
          }
        }
      )
      copyFile(
        path.join(binDir, 'uv'),
        path.join(binDir, 'uv-universal-apple-darwin'),
        (err) => {
          if (err) {
            console.log('Error Found:', err)
          }
        }
      )
    } else if (platform === 'linux') {
      copyFile(
        path.join(binDir, 'uv'),
        path.join(binDir, 'uv-x86_64-unknown-linux-gnu'),
        (err) => {
          if (err) {
            console.log('Error Found:', err)
          }
        }
      )
    }
  } catch (err) {
    // Expect EEXIST error
  }
  try {
    copySync(path.join(tempBinDir, 'uv.exe'), path.join(binDir))
    if (platform === 'win32') {
      copyFile(
        path.join(binDir, 'uv.exe'),
        path.join(binDir, 'uv-x86_64-pc-windows-msvc.exe'),
        (err) => {
          if (err) {
            console.log('Error Found:', err)
          }
        }
      )
    }
  } catch (err) {
    // Expect EEXIST error
  }
  console.log('UV downloaded.')

  // ----- codebase-memory-mcp (bundled with the app, no user install required) -----
  // `codebase-memory-mcp` is a single static binary published on the
  // DeusData/codebase-memory-mcp GitHub releases. Bundling it means a fresh
  // Jan install works out of the box without the user having to `pip install
  // codebase-memory-mcp` or set anything on PATH.
  try {
    const isWindows = platform === 'win32'
    const finalName = isWindows ? 'codebase-memory-mcp.exe' : 'codebase-memory-mcp'
    const finalPath = path.join(binDir, finalName)
    const stagedName = isWindows
      ? 'codebase-memory-mcp.exe'
      : 'codebase-memory-mcp'

    if (fs.existsSync(finalPath)) {
      console.log(`codebase-memory-mcp already present at ${finalPath}`)
    } else {
      const cbmUrl = `https://github.com/DeusData/codebase-memory-mcp/releases/latest/download/${cbmArchiveName}`
      console.log(`Downloading codebase-memory-mcp from ${cbmUrl}...`)
      await download(cbmUrl, cbmArchivePath)
      await decompress(cbmArchivePath, tempBinDir)

      // The archive is laid out either as `codebase-memory-mcp/...` or a flat
      // directory of a single binary. Walk the extracted tree to find the
      // first executable that matches the expected name.
      const candidates = []
      function walk(dir) {
        for (const entry of fs.readdirSync(dir)) {
          const full = path.join(dir, entry)
          let stat
          try {
            stat = fs.statSync(full)
          } catch {
            continue
          }
          if (stat.isDirectory()) walk(full)
          else if (entry === stagedName) candidates.push(full)
        }
      }
      walk(tempBinDir)

      if (candidates.length === 0) {
        throw new Error(
          `Could not find ${stagedName} inside the extracted archive`
        )
      }

      fs.copyFileSync(candidates[0], finalPath)
      if (!isWindows) {
        try {
          fs.chmodSync(finalPath, 0o755)
        } catch (err) {
          console.log('Add execution permission failed!', err)
        }
      }
      console.log(`codebase-memory-mcp installed at ${finalPath}`)

      // Mirror the platform-triple suffix that other bundled binaries use so
      // dev builds and CI stubs can find a familiar name (e.g. the GitHub
      // workflow stubs create `bun-${TRIPLE}` next to the unsuffixed binary).
      const tripleSuffixes = []
      if (platform === 'darwin') {
        tripleSuffixes.push(
          arch === 'arm64'
            ? 'aarch64-apple-darwin'
            : 'x86_64-apple-darwin'
        )
      } else if (platform === 'linux') {
        tripleSuffixes.push(
          arch === 'arm64'
            ? 'aarch64-unknown-linux-gnu'
            : 'x86_64-unknown-linux-gnu'
        )
      } else if (platform === 'win32') {
        tripleSuffixes.push('x86_64-pc-windows-msvc')
      }
      for (const triple of tripleSuffixes) {
        const tripleName = isWindows
          ? `codebase-memory-mcp-${triple}.exe`
          : `codebase-memory-mcp-${triple}`
        const triplePath = path.join(binDir, tripleName)
        try {
          fs.copyFileSync(finalPath, triplePath)
          if (!isWindows) {
            try {
              fs.chmodSync(triplePath, 0o755)
            } catch {
              // best-effort
            }
          }
        } catch (err) {
          console.log(`Failed to create triple-suffixed copy: ${err}`)
        }
      }
    }
  } catch (err) {
    console.log('codebase-memory-mcp download step failed (non-fatal):', err)
  }

  // ----- sqlite-vec (optional, ANN acceleration) -----
  try {
    const binDir = 'src-tauri/resources/bin'
    const platform = os.platform()
    const ext = platform === 'darwin' ? 'dylib' : platform === 'win32' ? 'dll' : 'so'
    const targetLibPath = path.join(binDir, `sqlite-vec.${ext}`)

    if (fs.existsSync(targetLibPath)) {
      console.log(`sqlite-vec already present at ${targetLibPath}`)
    } else {
      let sqlvecUrl = await fetchLatestSqliteVecUrl(platform, os.arch())
      // Allow override via env if needed
      if ((process.env.SQLVEC_URL || process.env.JAN_SQLITE_VEC_URL) && !sqlvecUrl) {
        sqlvecUrl = process.env.SQLVEC_URL || process.env.JAN_SQLITE_VEC_URL
      }
      if (!sqlvecUrl) {
        console.log('Could not determine sqlite-vec download URL; skipping (linear fallback will be used).')
      } else {
        console.log(`Downloading sqlite-vec from ${sqlvecUrl}...`)
        const sqlvecArchive = path.join(tempBinDir, `sqlite-vec-download`)
        const guessedExt = sqlvecUrl.endsWith('.zip') ? '.zip' : sqlvecUrl.endsWith('.tar.gz') ? '.tar.gz' : ''
        const archivePath = sqlvecArchive + guessedExt
        await download(sqlvecUrl, archivePath)
        if (!guessedExt) {
          console.log('Unknown archive type for sqlite-vec; expecting .zip or .tar.gz')
        } else {
          await decompress(archivePath, tempBinDir)
          // Try to find a shared library in the extracted files
          const candidates = []
          function walk(dir) {
            for (const entry of fs.readdirSync(dir)) {
              const full = path.join(dir, entry)
              const stat = fs.statSync(full)
              if (stat.isDirectory()) walk(full)
              else if (full.endsWith(`.${ext}`)) candidates.push(full)
            }
          }
          walk(tempBinDir)
          if (candidates.length === 0) {
            console.log('No sqlite-vec shared library found in archive; skipping copy.')
          } else {
            // Pick the first match and copy/rename to sqlite-vec.<ext>
            const libSrc = candidates[0]
            // Ensure we copy the FILE, not a directory (fs-extra copySync can copy dirs)
            if (fs.statSync(libSrc).isFile()) {
              fs.copyFileSync(libSrc, targetLibPath)
              console.log(`sqlite-vec installed at ${targetLibPath}`)
            } else {
              console.log(`Found non-file at ${libSrc}; skipping.`)
            }
          }
        }
      }
    }
  } catch (err) {
    console.log('sqlite-vec download step failed (non-fatal):', err)
  }

  console.log('Downloads completed.')
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
