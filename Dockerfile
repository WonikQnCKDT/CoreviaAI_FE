# syntax=docker/dockerfile:1.6
# 1조 WEB_PORT=8081 은 compose 가 호스트에 연다. 컨테이너 내부 nginx 는 80.
# 빌드 컨텍스트는 저장소 루트다(CI: docker/build-push-action context ".").
# Node 버전은 CI(actions/setup-node 26.13.0)와 같은 26으로 맞춘다.

FROM node:26-alpine AS build

# 화면 모드는 Vite가 빌드할 때 번들에 새겨 넣는다(실행 환경 변수로는 바꿀 수 없다).
# 배포 이미지는 실제 서버에 붙는 api가 기본이다. 데모 이미지가 필요하면 --build-arg VITE_AUTH_MODE=demo.
# .dockerignore가 .env*를 빼므로 여기서 받는 값만 쓰인다.
ARG VITE_AUTH_MODE=api
ENV VITE_AUTH_MODE=$VITE_AUTH_MODE
# 오타·대소문자 차이로 조용히 demo가 되지 않게 허용값이 아니면 빌드를 멈춘다
RUN case "$VITE_AUTH_MODE" in \
      api) ;; \
      demo) echo "WARNING: VITE_AUTH_MODE=demo 로 빌드합니다. 서버에 연결하지 않는 데모 화면입니다." ;; \
      *) echo "ERROR: VITE_AUTH_MODE는 api 또는 demo여야 합니다(받은 값: '$VITE_AUTH_MODE')." >&2; exit 1 ;; \
    esac

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
