interface GPGOptions {
    armor?: boolean;
    hash?: string;
    recipient?: string;
    sign?: boolean;
}

interface Answer extends GPGOptions {
    accept?: boolean;
    generatePassword?: boolean;
    histignore?: string;
    histignoreFile?: string;
    installDir?: string;
    key?: string
    name?: string
    newField?: boolean;
    password?: string;
    rm?: string
    url?: string
    username?: string;
    value?: string;
}

interface Entry {
    key: string;
    password: string;
    url: string;
    username: string;
}

// Probably come up with a better name here.
interface HasChanged {
    changed: boolean;
}

interface Stymie {
    add(key: string): void;
    edit(key: string): void;
    get(key: string, field?: string): void;
    has(key: string): void;
    list(): void;
    rm(key: string): void;
    [propName: string]: any;
}

export { Answer, Entry, GPGOptions, HasChanged, Stymie };

