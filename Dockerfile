FROM ghcr.io/flagbit/bitwarden-cli:1.0.2

ENV XDG_CONFIG_HOME=/tmp/.config

COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]