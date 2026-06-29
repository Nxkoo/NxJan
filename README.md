# NxJan

Local AI chat — run LLMs on your machine with full control and privacy.

<p align="center">
  <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/Nxkoo/NxJan"/>
  <img alt="Github Last Commit" src="https://img.shields.io/github/last-commit/Nxkoo/NxJan"/>
  <img alt="Github Contributors" src="https://img.shields.io/github/contributors/Nxkoo/NxJan"/>
</p>

<p align="center">
  <a href="https://github.com/Nxkoo/NxJan/issues">Bug reports</a>
  ·
  <a href="https://github.com/Nxkoo/NxJan/releases">Releases</a>
</p>

NxJan brings open-source AI models into a desktop app you can run locally. Download models from HuggingFace, chat offline, and connect cloud providers when you need them.

## Features

- **Local AI Models**: Download and run LLMs (Llama, Gemma, Qwen, GPT-oss, etc.)
- **Cloud Integration**: OpenAI, Anthropic, Mistral, Groq, MiniMax, and more
- **Custom Assistants**: Create specialized AI assistants for your tasks
- **OpenAI-Compatible API**: Local server at `localhost:1337`
- **Model Context Protocol**: MCP integration for agentic workflows
- **Privacy First**: Run everything locally when you want to

## Build from Source

### Prerequisites

- Node.js ≥ 20.0.0
- Yarn ≥ 4.5.3
- Make ≥ 3.81
- Rust (for Tauri)
- (macOS Apple Silicon only) MetalToolchain `xcodebuild -downloadComponent MetalToolchain`

### Quick start

```bash
git clone https://github.com/Nxkoo/NxJan
cd NxJan
make dev
```

**Make targets:**
- `make dev` — development setup and launch
- `make build` — production build
- `make test` — tests and linting
- `make clean` — clean build artifacts

### Manual commands

```bash
yarn install
yarn build
yarn dev
```

## System Requirements

- **macOS**: 13.6+ (8GB RAM for 3B models, 16GB for 7B, 32GB for 13B)
- **Windows**: 10+ with GPU support for NVIDIA/AMD/Intel Arc
- **Linux**: Most distributions; GPU acceleration available

## Contributing

Contributions welcome. Open an issue or PR on [GitHub](https://github.com/Nxkoo/NxJan).

## License

Apache 2.0

## Acknowledgements

NxJan © 2026 [Nxkoo](https://github.com/Nxkoo).

Includes software from [Jan](https://github.com/janhq/jan) (Menlo Research), licensed under Apache 2.0.

Built with:

- [Llama.cpp](https://github.com/ggerganov/llama.cpp)
- [Tauri](https://tauri.app/)
- [Scalar](https://github.com/scalar/scalar)