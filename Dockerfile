FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=4173 SENTINEL_X_HOST=127.0.0.1
COPY --chown=node:node package.json ./
COPY --chown=node:node index.html server.js ./
COPY --chown=node:node src ./src
COPY --chown=node:node server ./server
COPY --chown=node:node services ./services
COPY --chown=node:node scripts ./scripts
RUN mkdir -p /app/data /app/backups && chown -R node:node /app
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:4173/api/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","server.js"]
