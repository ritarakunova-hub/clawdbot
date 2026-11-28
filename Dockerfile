FROM node:22-slim

ENV NODE_ENV=production
ENV PORT=3000
ENV PENDING_FILE=/data/pending.json

WORKDIR /app

COPY content-autopilot/package.json content-autopilot/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node content-autopilot/ ./
RUN mkdir -p /data && chown node:node /data

USER node

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.js"]
