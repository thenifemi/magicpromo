FROM node:24-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app

# Copy workspace manifests too; npm ci resolves the extension workspace.
COPY . .
RUN npm ci
RUN npm run build:render

FROM node:24-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
COPY --from=build --chown=node:node /app /app
USER node
CMD ["npm", "run", "start:render"]
