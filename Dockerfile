FROM scratch

LABEL org.opencontainers.image.title="ss14-cookbook"

COPY public/ /site/

CMD ["/site"]
