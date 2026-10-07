# Getting started with Docker

## What is Docker ?

Docker is an open-source containerization platform that packages an application along with its dependencies, libraries, and configuration into a container so that it runs consistently across different environments.

Why Docker?
- Portability: Run applications on any system that supports Docker.
- Consistency: Eliminate the "It works on my machine" problem.
- Isolation: Run multiple applications independently without dependency conflicts.
- Lightweight: Containers use fewer resources than traditional virtual machines.
- Scalability: Easily create or remove containers as needed.
- Fast Deployment: Build, distribute, and deploy applications quickly.


# Build the Docker image
docker build -t api-backend .

# Run the container
docker run -d -p 5001:5000 --name node-app api-backend:latest

# View logs
docker logs -f node-app

# Stop the container
docker stop node-app