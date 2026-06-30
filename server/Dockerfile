FROM node:20-alpine

WORKDIR /app

# ffmpeg extracts frames + audio; yt-dlp downloads the reel (pulls in python3)
RUN apk add --no-cache ffmpeg yt-dlp

COPY package*.json ./
# No package-lock in this pnpm workspace, so use install (not ci) for prod deps
RUN npm install --omit=dev

COPY dist ./dist

EXPOSE 3001
CMD ["node", "dist/index.js"]
