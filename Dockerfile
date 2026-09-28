# Stage 1: Build
FROM node:20-alpine AS build-stage

LABEL maintainer="dharmadutta"

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .
ARG VITE_ENV_SALT
ARG VITE_YOUTUBE_API_KEY
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ARG VITE_AUTH0_SMS_CONNECTION
ARG VITE_AUTH0_GOOGLE_CONNECTION
ARG VITE_LOCATIONIQ_TOKEN
ENV VITE_ENV_SALT=${VITE_ENV_SALT}
ENV VITE_YOUTUBE_API_KEY=${VITE_YOUTUBE_API_KEY}
ENV VITE_AUTH0_DOMAIN=${VITE_AUTH0_DOMAIN}
ENV VITE_AUTH0_CLIENT_ID=${VITE_AUTH0_CLIENT_ID}
ENV VITE_AUTH0_AUDIENCE=${VITE_AUTH0_AUDIENCE}
ENV VITE_AUTH0_SMS_CONNECTION=${VITE_AUTH0_SMS_CONNECTION}
ENV VITE_AUTH0_GOOGLE_CONNECTION=${VITE_AUTH0_GOOGLE_CONNECTION}
ENV VITE_LOCATIONIQ_TOKEN=${VITE_LOCATIONIQ_TOKEN}
RUN npm run build

FROM nginx:stable-alpine

WORKDIR /app

RUN chown nginx:nginx /app && apk add --no-cache gettext

ENV PORT=4173
# Defaults for the library proxy, so the container still starts where the deploy
# has not set them yet; an empty proxy_pass would fail nginx's config check.
ENV VITE_LIBRARY_BASE_URL=https://library.webuddhist.com
ENV VITE_LIBRARY_APP_NAME=webuddhist

# Copy the React build files into Nginx's public directory
COPY --from=build-stage /app/dist /usr/share/nginx/html

COPY nginx/nginx.conf /etc/nginx/
COPY nginx/studio.conf.template /etc/nginx/conf.d/
COPY nginx/security-headers.conf /etc/nginx/

EXPOSE 4173

CMD ["sh", "-c", "envsubst '${VITE_BACKEND_BASE_URL} ${VITE_YOUTUBE_API_KEY} ${VITE_LIBRARY_BASE_URL} ${VITE_LIBRARY_APP_NAME}' < /etc/nginx/conf.d/studio.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
