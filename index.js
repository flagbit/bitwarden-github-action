const core = require('@actions/core');
const command = require('@actions/core/lib/command');
const shell = require('shelljs');
const bitwarden_cli = 'bw'
const maxAttempts = 5
const sleepTime = 5

let globalCounter = 0
let globalError = false;
let globalSuccessSecrets = [];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getSecretsInputAsArray(secrets) {
    let result = []
    let secretsArray = secrets.split("\n")

    for (var i = 0; i < secretsArray.length; i++) {
        let secretsLine = secretsArray[i].replace(/\s/g, "")
        if (!secretsLine) {
            continue
        }

        let secretParts = secretsLine.split('|')
        result.push({
            collectionName: secretParts[0].replace(/\s/g, ""),
            itemName: secretParts[1].replace(/\s/g, ""),
            itemType: secretParts[2].replace(/\s/g, ""),
            envVarName: secretParts[3].replace(/\s/g, "")
        })
    }

    return result
}

secretInputs = getSecretsInputAsArray(core.getInput('secrets', {required: true}))

while (globalCounter < maxAttempts && secretInputs.length !== globalSuccessSecrets.length) {
    try {
        const clientId = core.getInput('client_id', {required: true});
        const clientSecret = core.getInput('client_secret', {required: true});
        const masterPassword = core.getInput('master_password', {required: true});
        const showSecrets = core.getInput('show_secrets', {required: true});

        process.env['XDG_CONFIG_HOME'] = '/tmp/.config'

        let counter = 0
        while (shell.exec(`${bitwarden_cli} login --check`, {silent: true}).code !== 0 && counter < maxAttempts) {
            console.log('You are not logged in. Trying login...')
            if (shell.exec(`BW_CLIENTID="${clientId}" BW_CLIENTSECRET="${clientSecret}" ${bitwarden_cli} login --raw --apikey`).code !== 0) {
                console.log('Bitwarden login failed!')
                console.log(`Waiting ${sleepTime} seconds for retry...`)
                sleep(sleepTime * 1000)
            } else {
                console.log('Bitwarden login succeed!')
            }
            counter++
        }

        if (shell.exec(`${bitwarden_cli} login --check`, {silent: true}).code !== 0) {
            throw new Error(`Could not login to bitwarden after ${counter} tries. Exiting...`);
        }

        process.env['INPUT_MASTER_PASSWORD'] = masterPassword;
        process.env['BW_SESSION'] = shell.exec(`${bitwarden_cli} unlock --raw --passwordenv INPUT_MASTER_PASSWORD`, {silent: true});
        shell.exec(`${bitwarden_cli} sync --force`, {silent: true})

        counter = 0
        secretInputs.forEach(function (secret) {
            let collectionName = secret.collectionName
            let itemName = secret.itemName
            let itemType = secret.itemType
            let envVarName = secret.envVarName

            console.log(`Bitwarden collection name: ${collectionName}`)
            console.log(`Bitwarden item name: ${itemName}`)
            console.log(`Environment var name: ${envVarName}`)

            if (globalSuccessSecrets.indexOf(`${collectionName}:${itemName}:${envVarName}`) >= 0) {
                console.log(`Secret already set. Skipping`)

                return
            }

            let collectionId
            while (counter < maxAttempts) {
                collectionId = shell.exec(`${bitwarden_cli} list collections | jq --raw-output '.[] | select(.name=="${collectionName}") | .id'`, {silent: true}).stdout
                collectionId = collectionId.replace(/[\r\n]/gm, '')
                if (!collectionId) {
                    console.log(`Collection id not found. Trying again in ${sleepTime}s.`)
                    shell.exec(`sleep ${sleepTime}`)
                } else {
                    break
                }
            }

            if (!collectionId) {
                throw new Error(`Collection id not found after ${counter} tries.`)
            }

            console.log(`Bitwarden collection id: ${collectionId}`)

            let secretValue = shell.exec(`${bitwarden_cli} list items | jq --raw-output '.[] | select(.collectionIds | index("${collectionId}")) | select (.name=="${itemName}") | .${itemType}'`, {silent: true}).stdout

            if (!secretValue) {
                console.log("Secret value is empty!")
            } else {
                console.log("Secret value found!")
                globalSuccessSecrets.push(`${collectionName}:${itemName}:${envVarName}`)
                secretValue = secretValue.trim()
                if (showSecrets == 'false') {
                    command.issue('add-mask', secretValue);
                }
                core.exportVariable(`${envVarName}`, `${secretValue}`);
            }
        })

    } catch (error) {
        console.log(error.message)
        globalError = error.message;
    } finally {
        shell.exec(`${bitwarden_cli} lock`, {silent: true})
        shell.exec(`${bitwarden_cli} logout`, {silent: true})
    }

    globalCounter++
    sleep(sleepTime * 1000)
}

if (globalError) {
    core.setFailed(globalError);
}
