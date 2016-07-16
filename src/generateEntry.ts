import * as diceware from 'diceware';
import * as inquirer from 'inquirer';
import * as jcrypt from 'jcrypt';
import * as util from './util';
import { Answer, Entry } from './interfaces';

const log = util.log;
const logError = util.logError;
const logInfo = util.logInfo;
const logSuccess = util.logSuccess;
const env = process.env;
const keyFile = `${env.STYMIE || env.HOME}/.stymie.d/k`;

let iter;

function* generateEntry(key: string): string {
    let entry: Entry = yield getCredentials(key);
    entry = yield getFields(entry);
    yield makeEntry(entry);
}

function makePassphrase(entry: Entry): void {
    if (entry.password !== undefined) {
        iter.next(entry);
    } else {
        const password = diceware.generate();

        log(password);

        inquirer.prompt([{
            type: 'list',
            name: 'accept',
            message: 'Accept?:',
            choices: [
                {name: 'Yes', value: true},
                {name: 'No, generate another', value: false}
            ]
        }], (answers: Answer) => {
            if (answers.accept) {
                entry.password = password;
                iter.next(entry);
            } else {
                makePassphrase(entry);
            }
        });
    }
}

function getCredentials(key: string): void {
    jcrypt(keyFile, null, ['--decrypt'], true)
    .then((data: string): void => {
        const list = JSON.parse(data);

        if (list[key]) {
            logInfo('Key already exists');
        } else {
            inquirer.prompt([{
                type: 'input',
                name: 'url',
                message: 'Enter url:',
                validate: util.noBlanks
            }, {
                type: 'input',
                name: 'username',
                message: 'Enter username:',
                validate: util.noBlanks
            }, {
                type: 'list',
                name: 'generatePassword',
                message: 'Generate diceware password?',
                default: false,
                choices: [
                    {name: 'Yes', value: true},
                    {name: 'No', value: false}
                ]
            }, {
                type: 'password',
                name: 'password',
                message: 'Enter password:',
                validate: util.noBlanks,
                when: answers => !answers.generatePassword
            }], (answers: Answer) =>
                makePassphrase({
                    key: key,
                    url: answers.url,
                    username: answers.username,
                    password: answers.password
                })
            );
        }
    })
    .catch(logError);
}

function getFields(entry: Entry): void {
    inquirer.prompt([{
        type: 'list',
        name: 'newField',
        message: 'Create another field?:',
        choices: [
            {name: 'Yes', value: true},
            {name: 'No', value: false}
        ]
    }, {
        type: 'input',
        name: 'name',
        message: 'Name:',
        validate: util.noBlanks,
        when: answers => answers.newField
    }, {
        type: 'input',
        name: 'value',
        message: 'Value:',
        validate: util.noBlanks,
        when: answers => answers.newField
    }], (answers: Answer) => {
        if (!answers.newField) {
            iter.next(entry);
        } else {
            entry[answers.name] = answers.value;
            getFields(entry);
        }
    });
}

function makeEntry(entry: Entry): void {
    jcrypt(keyFile, null, ['--decrypt'], true)
    .then((data: string): string => {
        const list = JSON.parse(data);
        const item = list[entry.key] = {};

        // TODO: Iterator.
        for (let n in entry) {
            if (entry.hasOwnProperty(n) && n !== 'key') {
                item[n] = entry[n];
            }
        }

        return jcrypt.stream(JSON.stringify(list, null, 4), keyFile, {
            gpg: util.getGPGArgs(),
            file: {
                flags: 'w',
                defaultEncoding: 'utf8',
                fd: null,
                mode: 0o0600
            }
        }, true);
    })
    .then((): void => logSuccess('Entry created successfully'))
    .catch(logError);
}

export = (key?: string): void => {
    if (!key) {
        logError('No key name');
        return;
    }

    iter = generateEntry(key);
    iter.next();
};

