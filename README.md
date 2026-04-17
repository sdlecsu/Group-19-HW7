## How to run this project

### Quick start (recommended)

1. Install [Node.js](https://nodejs.org/) (v12.22+ required; v18+ recommended).
2. Clone this repository and enter the project folder.
3. Install dependencies:
   - `npm install`
4. Start MongoDB (choose one):
   - Local MongoDB service already installed and running on `127.0.0.1:27017`, or
   - Docker: `npm run mongo:up`
5. Start the app:
   - `npm start`
6. Open `http://localhost:3000`.

### Environment variables

- `MONGODB_URI` (optional): defaults to `mongodb://127.0.0.1:27017`
- `PORT` (optional): defaults to `3000`
- `DB_NAME` (optional): defaults to the current project folder name (to satisfy the assignment DB naming rule)

You can copy `.env.example` values into your shell before starting the app if needed.

### Notes for graders/instructors

- The app auto-creates the `lists` collection and an index on `title` at startup.
- The required database name is derived from the project folder name by default.
- If using Docker MongoDB, stop it with `npm run mongo:down`.

### Troubleshooting

- `ECONNREFUSED 127.0.0.1:27017`
  - MongoDB is not running. Start local MongoDB or run `npm run mongo:up`.
- `bad auth : authentication failed`
  - Atlas credentials are invalid or the password is not URL-encoded.
- App does not load at `localhost:3000`
  - Check that `npm start` is still running and started without errors.
