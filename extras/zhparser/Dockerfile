# Postgres 17 + zhparser（基于 SCWS 的中文分词扩展）
#
# 构建：  docker build -t postgres-zhparser:17 extras/zhparser
# 运行：  docker run --name postgres-zh -e POSTGRES_PASSWORD=password \
#           -p 5432:5432 -d postgres-zhparser:17
#
# 采用多阶段构建：编译依赖只装在 build 阶段，最终镜像只拷贝编译产物。
# 不要在运行中的容器里直接 apt install postgresql-server-dev-17 ——
# 它可能顺带把服务器自带的扩展库升级到更新的小版本，导致 pg_trgm 等扩展无法加载。

ARG PG_IMAGE=postgres:17.2

FROM ${PG_IMAGE} AS build
ARG SCWS_VERSION=1.2.3
ARG ZHPARSER_COMMIT=2e995c4df672563992b4d7a147b8fa2d0d4cda6c
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential ca-certificates git wget bzip2 \
      postgresql-server-dev-${PG_MAJOR} \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /build
RUN wget -q -O - http://www.xunsearch.com/scws/down/scws-${SCWS_VERSION}.tar.bz2 | tar xjf - \
 && cd scws-${SCWS_VERSION} && ./configure && make && make install
RUN git clone https://github.com/amutu/zhparser.git \
 && cd zhparser && git checkout ${ZHPARSER_COMMIT} \
 && make && make install

FROM ${PG_IMAGE}
COPY --from=build /usr/local/lib/libscws.so* /usr/local/lib/
COPY --from=build /usr/lib/postgresql/${PG_MAJOR}/lib/zhparser.so /usr/lib/postgresql/${PG_MAJOR}/lib/
COPY --from=build /usr/share/postgresql/${PG_MAJOR}/extension/zhparser* /usr/share/postgresql/${PG_MAJOR}/extension/
COPY --from=build /usr/share/postgresql/${PG_MAJOR}/tsearch_data/dict.utf8.xdb \
                  /usr/share/postgresql/${PG_MAJOR}/tsearch_data/rules.utf8.ini \
                  /usr/share/postgresql/${PG_MAJOR}/tsearch_data/
RUN ldconfig
