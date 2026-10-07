# API Backend + Playwright API Tests

This project runs the Express API backend and the Playwright API test suite with Docker Compose.

MongoDB is external and uses MongoDB Atlas. There is no local MongoDB container.

## Prerequisites

- Docker Desktop
- A MongoDB Atlas connection string
- Your Atlas Network Access must allow your current public IP

## Environment Setup

Create a root `.env` file from the example:

```powershell
copy .env.example .env
notepad .env
```

Set the real values:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database-name
JWT_SECRET=your-secret
```

The root `.env` file is ignored by Git.

## Build Images

From the project root:

```powershell
cd D:\Testing\Playwrite\DevOps
docker compose build
```

## Run Backend Only

```powershell
docker compose up --build api-backend
```

The backend is exposed on:

```text
http://localhost:5001
```

Health check:

```powershell
curl http://localhost:5001/health
```

## Run Backend + API Tests

```powershell
docker compose up --build api-testing
```

This command:

- builds the backend image
- builds the Playwright test image
- starts the backend container
- waits for `/health`
- runs the Playwright API tests
- exits with the test result

## Stop Containers

After running tests or the backend:

```powershell
docker compose down
```

## Clean Rebuild

Use this if Docker cache causes stale behavior:

```powershell
docker compose build --no-cache
docker compose up api-testing
```

## Logs and Debugging

Show running services:

```powershell
docker compose ps
```

Backend logs:

```powershell
docker compose logs api-backend
```

Test runner logs:

```powershell
docker compose logs api-testing
```

Follow backend logs live:

```powershell
docker compose logs -f api-backend
```

## Useful Cleanup Commands

Stop and remove containers/network:

```powershell
docker compose down
```

Remove built images for this project:

```powershell
docker rmi devops-api-backend devops-api-testing
```

## Notes

- The backend listens on `0.0.0.0` inside Docker so other containers can reach it.
- Generated upload URLs use `PUBLIC_HOSTNAME=api-backend` inside Docker so Playwright can resolve uploaded images.
- The backend automatically creates the `uploads` directory when files are uploaded.
- The Playwright container includes backend source files because `backend-units.spec.ts` imports backend modules directly.

docker compose up --build api-testing
docker compose up -d api-testing
docker compose up -d --build api-testing
docker compose run --rm api-testing sh
`services:

  mongo:
    image: mongo:8

  api:
    build:
      context: ./backend

    environment:
      PORT: 5000
      MONGO_URI: mongodb://mongo:27017/testdb

    ports:
      - "5000:5000"

    depends_on:
      - mongo

  api-testing:
    build:
      context: .

    environment:
      API_BASE_URL: http://api:5000

    depends_on:
      - api
`

sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
docker --version
docker compose version
sudo docker run hello-world
systemctl status jenkins
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
sudo -u jenkins docker ps
sudo -u jenkins docker compose version
ENV NODE_ENV=production
