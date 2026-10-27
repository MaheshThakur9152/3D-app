# Stage 1: Build the Vite SPA
FROM node:24-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY rendering/package*.json ./
RUN npm install

# Copy frontend source and static assets
COPY rendering/ ./
RUN npm run build

# Stage 2: Serve via Nginx
FROM nginx:alpine

COPY rendering/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -q -O - http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
