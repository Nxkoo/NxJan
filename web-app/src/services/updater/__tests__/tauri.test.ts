import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}))

import { check } from '@tauri-apps/plugin-updater'
import { TauriUpdaterService } from '../tauri'
import { DefaultUpdaterService } from '../default'

describe('TauriUpdaterService', () => {
  let svc: TauriUpdaterService

  beforeEach(() => {
    vi.mocked(check).mockReset()
    svc = new TauriUpdaterService()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('extends DefaultUpdaterService', () => {
    expect(svc).toBeInstanceOf(DefaultUpdaterService)
  })

  describe('check()', () => {
    it('returns update info when Tauri updater finds a release', async () => {
      const mockUpdate = {
        version: '2.0.0',
        date: '2026-01-01',
        body: 'Release notes',
      }
      vi.mocked(check).mockResolvedValueOnce(mockUpdate as any)

      const result = await svc.check()

      expect(check).toHaveBeenCalledTimes(1)
      expect(result).toEqual({
        version: '2.0.0',
        date: '2026-01-01',
        body: 'Release notes',
      })
    })

    it('returns null when no update is available', async () => {
      vi.mocked(check).mockResolvedValueOnce(null as any)

      const result = await svc.check()

      expect(check).toHaveBeenCalledTimes(1)
      expect(result).toBeNull()
    })

    it('returns null and logs error when the Tauri updater throws', async () => {
      vi.mocked(check).mockRejectedValueOnce(new Error('manifest 404'))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await svc.check()

      expect(result).toBeNull()
      expect(errorSpy).toHaveBeenCalledWith(
        'Error checking for updates in Tauri:',
        expect.any(Error)
      )
      errorSpy.mockRestore()
    })
  })

  describe('installAndRestart()', () => {
    it('downloads and installs when update is available', async () => {
      const mockDownloadAndInstall = vi.fn().mockResolvedValue(undefined)
      vi.mocked(check).mockResolvedValueOnce({
        version: '2.0.0',
        downloadAndInstall: mockDownloadAndInstall,
      } as any)

      await svc.installAndRestart()

      expect(check).toHaveBeenCalled()
      expect(mockDownloadAndInstall).toHaveBeenCalled()
    })

    it('does nothing when no update is available', async () => {
      vi.mocked(check).mockResolvedValueOnce(null as any)

      await svc.installAndRestart()

      expect(check).toHaveBeenCalled()
    })

    it('logs error and rethrows when check fails', async () => {
      const err = new Error('install fail')
      vi.mocked(check).mockRejectedValueOnce(err)
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(svc.installAndRestart()).rejects.toBe(err)
      expect(errorSpy).toHaveBeenCalledWith(
        'Error installing update in Tauri:',
        err
      )
      errorSpy.mockRestore()
    })

    it('logs error and rethrows when downloadAndInstall fails', async () => {
      const err = new Error('download fail')
      vi.mocked(check).mockResolvedValueOnce({
        version: '2.0.0',
        downloadAndInstall: vi.fn().mockRejectedValue(err),
      } as any)
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(svc.installAndRestart()).rejects.toBe(err)
      expect(errorSpy).toHaveBeenCalled()
      errorSpy.mockRestore()
    })
  })

  describe('downloadAndInstallWithProgress()', () => {
    it('calls downloadAndInstall with progress callback', async () => {
      const mockDownloadAndInstall = vi.fn().mockImplementation(async (cb) => {
        cb({ event: 'Started', data: { contentLength: 1000 } })
        cb({ event: 'Progress', data: { chunkLength: 500 } })
        cb({ event: 'Finished' })
      })
      vi.mocked(check).mockResolvedValueOnce({
        version: '2.0.0',
        downloadAndInstall: mockDownloadAndInstall,
      } as any)

      const progressCb = vi.fn()
      await svc.downloadAndInstallWithProgress(progressCb)

      expect(mockDownloadAndInstall).toHaveBeenCalled()
      expect(progressCb).toHaveBeenCalledTimes(3)
      expect(progressCb).toHaveBeenCalledWith({ event: 'Started', data: { contentLength: 1000 } })
      expect(progressCb).toHaveBeenCalledWith({ event: 'Finished' })
    })

    it('throws when no update is available', async () => {
      vi.mocked(check).mockResolvedValueOnce(null as any)
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(svc.downloadAndInstallWithProgress(vi.fn())).rejects.toThrow(
        'No update available'
      )
      errorSpy.mockRestore()
    })

    it('logs error and rethrows when download fails', async () => {
      const err = new Error('download error')
      vi.mocked(check).mockResolvedValueOnce({
        version: '2.0.0',
        downloadAndInstall: vi.fn().mockRejectedValue(err),
      } as any)
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(svc.downloadAndInstallWithProgress(vi.fn())).rejects.toBe(err)
      expect(errorSpy).toHaveBeenCalledWith(
        'Error downloading update with progress in Tauri:',
        err
      )
      errorSpy.mockRestore()
    })

    it('handles errors in progress callback gracefully', async () => {
      const mockDownloadAndInstall = vi.fn().mockImplementation(async (cb) => {
        cb({ event: 'Started' })
      })
      vi.mocked(check).mockResolvedValueOnce({
        version: '2.0.0',
        downloadAndInstall: mockDownloadAndInstall,
      } as any)

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const badCallback = vi.fn().mockImplementation(() => {
        throw new Error('callback error')
      })

      await svc.downloadAndInstallWithProgress(badCallback)

      expect(warnSpy).toHaveBeenCalledWith(
        'Error in download progress callback:',
        expect.any(Error)
      )
      warnSpy.mockRestore()
    })
  })
})
