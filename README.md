<h1 align="center">
  Bitwarden GitHub Action
  <br>
</h1>

<h4 align="center">A GitHub Action that simplifies using Bitwarden Vault secrets as build variables.</h4>

<p align="center">
    <a href="https://github.com/flagbit/bitwarden-github-action/actions/workflows/tests.yml"><img src="https://github.com/flagbit/bitwarden-github-action/actions/workflows/tests.yml/badge.svg"></a>
</p>

<p align="center">
  <a href="#example-usage">Example Usage</a>
</p>

## Example Usage

```yaml
jobs:
    build:
        # ...
        steps:
            # ...
            - name: Checkout bitwarden action
              uses: actions/checkout@v2
              with:
                repository: flagbit/bitwarden-github-action
                ref: v1.1.0
                token: ${{ secrets.GHCR_TOKEN }}
            - name: Import secrets
              uses: ./
              with:
                client_id: ${{ secrets.BW_CLIENTID }}
                client_secret: ${{ secrets.BW_CLIENTSECRET }}
                master_password: ${{ secrets.BW_MASTER_PASSWORD }}
                secrets: |
                  customer/wuerth_h | composer_json | notes | COMPOSER_AUTH
                  customer/wuerth_h | SSH_PRIVATE_KEY | notes | SSH_PRIVATE_KEY
                  customer/wuerth_h | staging_db | login.password | DATABASE_PASSWORD_STAGING
                  customer/wuerth_h | production_db | login.password | DATABASE_PASSWORD_PRODUCTION
            # ...
```

## Debugging

If during secrets usage something is unexpected and want to inspect the secret values you can disable the hidden secret
functionality by setting the input parameter `show_secrets: true`.

<br>

<p align="center">
Supported with :heart: by <a href="https://www.flagbit.de">Flagbit GmbH & Co. KG</a>
</p>
