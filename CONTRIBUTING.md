# Contributing to Agnes Film Studio

Thanks for your interest in contributing! This project helps small businesses create marketing videos with AI, and every contribution makes it better.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000`

## Development

- **Frontend**: React + TypeScript + Tailwind CSS (in `src/`)
- **Backend**: Express + WebSocket (in `server.ts`)
- **CLI**: Python tool (in `mfilm.py`, `agnes_video.py`)

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Type checking |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |

## Making Changes

1. Create a branch from `main`:
   ```bash
   git checkout -b feature/your-feature
   ```
2. Make your changes
3. Run lint and tests:
   ```bash
   npm run lint && npm run test
   ```
4. Commit with a clear message
5. Push and open a Pull Request

## Commit Messages

Use conventional commits:

- `feat: add new feature`
- `fix: bug fix`
- `docs: documentation change`
- `test: add or update tests`
- `refactor: code restructuring`

## Reporting Issues

Open a GitHub issue with:

- A clear title and description
- Steps to reproduce (for bugs)
- Expected vs actual behavior

## Code Style

- TypeScript strict mode
- Prefer named exports
- Keep components small and focused
- Write tests for new features

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
