const core = require('@actions/core');
const command = require('@actions/core/lib/command');
const shell = require('shelljs');

try {
    const clientId = core.getInput('client_id', { required: true });
    const clientSecret = core.getInput('client_secret', { required: true });
    const masterPassword = core.getInput('master_password', { required: true });
    const secrets = core.getInput('secrets', { required: true });
    const showSecrets = core.getInput('show_secrets', { required: true });
    const maxAttempts = 5
    const sleepTime = 5
    const bitwarden_cli = 'bw'

    process.env['XDG_CONFIG_HOME'] = '/tmp/.config'

    counter = 0
    while (shell.exec(`${bitwarden_cli} login --check`, {silent: true}).code !== 0 && counter < maxAttempts) {
        console.log('You are not logged in. Trying login...')
        if (shell.exec(`BW_CLIENTID="${clientId}" BW_CLIENTSECRET="${clientSecret}" ${bitwarden_cli} login --raw --apikey`).code !== 0) {
            console.log('Bitwarden login failed!')
            console.log(`Waiting ${sleepTime} seconds for retry...`)
            shell.exec(`sleep ${sleepTime}`)
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

    counter=0
    let secretsArray = secrets.split("\n")
    for (var i = 0; i < secretsArray.length; i++) {
        let secretsLine = secretsArray[i].replace(/\s/g, "")
        if (!secretsLine) {
            continue;
        }

        let secretParts = secretsLine.split('|')
        let collectionName=secretParts[0].replace(/\s/g, "")
        let itemName=secretParts[1].replace(/\s/g, "")
        let itemType=secretParts[2].replace(/\s/g, "")
        let envVarName=secretParts[3].replace(/\s/g, "")

        console.log(`Bitwarden collection name: ${collectionName}`)
        console.log(`Bitwarden item name: ${itemName}`)
        console.log(`Environment var name: ${envVarName}`)

        let collectionId
        while (counter < maxAttempts) {
            collectionId = shell.exec(`${bitwarden_cli} list collections | jq --raw-output '.[] | select(.name=="${collectionName}") | .id'`, {silent: true}).stdout
            collectionId= collectionId.replace(/[\r\n]/gm, '')
            if (!collectionId) {
                console.log(`Collection id not found. Trying again in ${sleepTime}s.`)
                shell.exec(`sleep ${sleepTime}`)
            } else {
                break
            }
            counter++
        }

        if (!collectionId) {
            throw new Error(`Collection id not found after ${counter} tries.`)
        }

        console.log(`Bitwarden collection id: ${collectionId}`)

        let secretValue=shell.exec(`${bitwarden_cli} list items | jq --raw-output '.[] | select(.collectionIds | index("${collectionId}")) | select (.name=="${itemName}") | .${itemType}'`, {silent: true}).stdout

        if (!secretValue) {
            console.log("Secret value is empty")
        } else {
            secretValue = secretValue.trim()
            if (showSecrets == 'false') {
                command.issue('add-mask', secretValue);
            }
            core.exportVariable(`${envVarName}`, `${secretValue}`);
        }
    }

    shell.exec(`${bitwarden_cli} lock`, {silent: true})
    shell.exec(`${bitwarden_cli} logout`, {silent: true})

} catch (error) {
    core.setFailed(error.message);
}