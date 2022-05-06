#!/bin/bash

max_attempts=3
sleep_time=10

# ensure Bitwarden data.json exists to avoid warning in login output
mkdir -p "${XDG_CONFIG_HOME}/Bitwarden CLI"
touch "${XDG_CONFIG_HOME}/Bitwarden CLI/data.json"

if ! bw login --check &> /dev/null; then
  try=0
  while [[ ${try} -lt ${max_attempts} ]]; do
    echo 'You are not logged in. Trying login...'
    BW_CLIENTID="${INPUT_CLIENT_ID}" BW_CLIENTSECRET="${INPUT_CLIENT_SECRET}" bw login --raw --apikey

    if bw login --check &> /dev/null; then
      echo 'Bitwarden login succeed!'

      break
    else
      echo 'Bitwarden login failed!'
      printf 'Waiting %d seconds for retry...\n' "${sleep_time}"
      sleep "${sleep_time}"
    fi

    ((try+=1))
  done

  if ! bw login --check &> /dev/null; then
    printf 'Could not login to bitwarden after %d tries. Exiting...\n' "${try}"

    exit 1
  fi
fi

export INPUT_MASTER_PASSWORD

BW_SESSION=$(bw unlock --raw --passwordenv INPUT_MASTER_PASSWORD)
export BW_SESSION

# Execute bitwarden sync to ensure information is up to date
bw sync --force > /dev/null

while read -r secrets_row; do
  # ignore empty lines
  if [[ -z "${secrets_row}" ]]; then
      continue
  fi

  collection_name=$(echo "${secrets_row}" | awk -F '|' '{print $1}' | xargs)
  item_name=$(echo "${secrets_row}" | awk -F '|' '{print $2}' | xargs)
  item_type=$(echo "${secrets_row}" | awk -F '|' '{print $3}' | xargs)
  env_var_name=$(echo "${secrets_row}" | awk -F '|' '{print $4}' | xargs)

  # skip empty lines
  if [[ -z "${collection_name}" ]]; then
    continue
  fi

  echo "Bitwarden collection name: ${collection_name}"
  echo "Bitwarden item name: ${item_name}"
  echo "Environment var name: ${env_var_name}"

  try=0
  while [[ ${try} -lt ${max_attempts} ]]; do
      collection_id=$(bw list collections | jq --raw-output '.[] | select(.name=="'"${collection_name}"'") | .id')
      if [[ -z "${collection_id}" ]]; then
          echo 'Collection id not found. Trying again in 3s.' 1>&2
          sleep 3
      else
        break
      fi
      ((try+=1))
  done

  if [[ -z "${collection_id}" ]]; then
    echo 'Collection id not found after %s tries.' "${try}" 1>&2
    exit 1
  fi

  echo "Bitwarden collection id: ${collection_id}"

  secret_value=$(bw list items | jq --raw-output '.[] | select(.collectionIds | index("'"${collection_id}"'")) | select (.name=="'"${item_name}"'") | .'"${item_type}"'')

  if [[ -z "${secret_value}" ]]; then
    echo "Secret value is empty"
  else
    echo "${env_var_name}<<EOF" >> "${GITHUB_ENV}"
    echo "${secret_value}" >> "${GITHUB_ENV}"
    echo "EOF" >> "${GITHUB_ENV}"
  fi
done < <(echo "${INPUT_SECRETS}")

bw lock
bw logout