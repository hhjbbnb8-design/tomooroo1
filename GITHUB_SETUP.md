# Run Tomorrow School in GitHub Codespaces

GitHub Pages cannot run this project because it needs a Node.js server, MySQL database, authentication sessions, and file storage. The repository is configured for GitHub Codespaces instead.

## Start the project

1. Open the repository: https://github.com/hhjbbnb8-design/tomooroo1
2. Select **Code** → **Codespaces** → **Create codespace on main**.
3. Wait for the setup to finish. The project installs dependencies and creates the local MySQL database automatically.
4. Open the Codespaces terminal and run:

```bash
pnpm dev
```

5. When GitHub shows port **3000**, open it in the browser.

## Local development accounts

The development seed creates these accounts:

- Teacher: `teacher` / `Teacher@1234`
- Student: `student` / `Student@1234`

The administrator account is intentionally not displayed in the login screen. Its password must be managed privately by the site owner.

## Important

Codespaces is a development environment and may stop when idle. For a permanent public deployment, use a Node.js host such as Render, Railway, Fly.io, or a VPS, together with a managed MySQL database and object storage. Do not commit `.env` files or production passwords to GitHub.
