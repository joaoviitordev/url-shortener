FROM node:24
WORKDIR /usr/src/app
RUN corepack enable
COPY package*.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install
COPY . .
RUN pnpm run build
EXPOSE 8080
CMD ["node", "dist/index.js"]