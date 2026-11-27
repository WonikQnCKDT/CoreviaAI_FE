# syntax=docker/dockerfile:1.6
# 1조 WEB_PORT=8081 은 compose 가 호스트에 연다. 컨테이너 내부 nginx 는 80.
# 빌드 컨텍스트는 저장소 루트다(CI: docker/build-push-action context ".").
# Node 버전은 CI(actions/setup-node 26.13.0)와 같은 26으로 맞춘다.

FROM node:26-alpine AS build

WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build

FROM nginx:1.27-alpine AS runtime

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/app.conf
COPY --from=build /src/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz || exit 1
