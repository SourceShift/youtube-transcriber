export interface RequestsProxyConfigDict {
    http: string;
    https: string;
}

export class InvalidProxyConfig extends Error {
    constructor(message = "Invalid proxy configuration") {
        super(message);
        this.name = 'InvalidProxyConfig';
    }
}

export abstract class ProxyConfig {
    abstract toRequestsDict(): RequestsProxyConfigDict;

    /**
     * If you are using rotating proxies, it can be useful to prevent the HTTP
     * client from keeping TCP connections alive, as your IP won't be rotated on
     * every request, if your connection stays open.
     */
    get preventKeepingConnectionsAlive(): boolean {
        return false;
    }

    /**
     * Defines how many times we should retry if a request is blocked. When using
     * rotating residential proxies with a large IP pool it can make sense to retry a
     * couple of times when a blocked IP is encountered, since a retry will trigger
     * an IP rotation and the next IP might not be blocked.
     */
    get retriesWhenBlocked(): number {
        return 0;
    }

    get isGeneric(): boolean {
        return false;
    }

    get isWebshare(): boolean {
        return false;
    }
}

export class GenericProxyConfig extends ProxyConfig {
    protected httpUrl: string | null;
    protected httpsUrl: string | null;

    constructor(httpUrl: string | null = null, httpsUrl: string | null = null) {
        super();
        if (!httpUrl && !httpsUrl) {
            throw new InvalidProxyConfig(
                "GenericProxyConfig requires you to define at least one of the two: http or https"
            );
        }
        this.httpUrl = httpUrl;
        this.httpsUrl = httpsUrl;
    }

    toRequestsDict(): RequestsProxyConfigDict {
        return {
            http: this.httpUrl || this.httpsUrl || "",
            https: this.httpsUrl || this.httpUrl || ""
        };
    }

    get isGeneric(): boolean {
        return true;
    }
}

export class WebshareProxyConfig extends ProxyConfig {
    static readonly DEFAULT_DOMAIN_NAME = "p.webshare.io";
    static readonly DEFAULT_PORT = 80;

    private proxyUsername: string;
    private proxyPassword: string;
    private domainName: string;
    private proxyPort: number;
    private _retriesWhenBlocked: number;

    constructor(
        proxyUsername: string,
        proxyPassword: string,
        retriesWhenBlocked = 10,
        domainName: string = WebshareProxyConfig.DEFAULT_DOMAIN_NAME,
        proxyPort: number = WebshareProxyConfig.DEFAULT_PORT
    ) {
        super();
        this.proxyUsername = proxyUsername;
        this.proxyPassword = proxyPassword;
        this.domainName = domainName;
        this.proxyPort = proxyPort;
        this._retriesWhenBlocked = retriesWhenBlocked;
    }

    get url(): string {
        return `http://${this.proxyUsername}-rotate:${this.proxyPassword}@${this.domainName}:${String(this.proxyPort)}/`;
    }

    get httpUrl(): string {
        return this.url;
    }

    get httpsUrl(): string {
        return this.url;
    }

    toRequestsDict(): RequestsProxyConfigDict {
        return {
            http: this.httpUrl,
            https: this.httpsUrl
        };
    }

    get preventKeepingConnectionsAlive(): boolean {
        return true;
    }

    get retriesWhenBlocked(): number {
        return this._retriesWhenBlocked;
    }

    get isWebshare(): boolean {
        return true;
    }

    get isGeneric(): boolean {
        return false;
    }
}