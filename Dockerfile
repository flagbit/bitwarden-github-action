FROM ghcr.io/flagbit/bitwarden-cli:1.0.2

COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]