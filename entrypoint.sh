#!/bin/bash

BW_CLIENTID="${INPUT_CLIENT_ID}" BW_CLIENTSECRET="${INPUT_CLIENT_SECRET}" bw login --raw --apikey

if bw login --check &> /dev/null; then
  echo 'Login succeed!'
else
  echo 'Login failed!'
  exit 1
fi

export INPUT_MASTER_PASSWORD

BW_SESSION=$(bw unlock --raw --passwordenv INPUT_MASTER_PASSWORD)

export BW_SESSION

while read -r secrets_row; do

  # ignore empty lines
  if [[ -z "${secrets_row}" ]]; then
      continue
  fi

  collection_name=$(echo "${secrets_row}" | awk -F '|' '{print $1}' | xargs)
  item_name=$(echo "${secrets_row}" | awk -F '|' '{print $2}' | xargs)
  enviroment_var_name=$(echo "${secrets_row}" | awk -F '|' '{print $3}' | xargs)

  if [[ -z "${collection_name}" ]]; then
    continue
  fi

  echo "bitwarden collection name: ${collection_name}"
  echo "bitwarden item name: ${item_name}"
  echo "environment var name: ${enviroment_var_name}"

  collection_id=$(bw list collections | jq --raw-output '.[] | select(.name=="'"${collection_name}"'") | .id')
  if [[ -z "${collection_id}" ]]; then
    echo 'Collection id not found' 1>&2
    exit 1
  fi

  echo "bitwarden collection id: ${collection_id}"

  secret_value=$(bw list items | jq --raw-output '.[] | select(.collectionIds | index("'"${collection_id}"'")) | select (.name=="'"${item_name}"'") | .notes')

  if [[ -z "${secret_value}" ]]; then
    echo "Secret value is empty"
  else
    echo "${enviroment_var_name}<<EOF" >> "${GITHUB_ENV}"
    echo "${secret_value}" >> "${GITHUB_ENV}"
    echo "EOF" >> "${GITHUB_ENV}"
  fi
done < <(echo "${INPUT_SECRETS}")

bw lock
bw logout