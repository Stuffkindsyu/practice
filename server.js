const http = require('http');
const https = require('https');

// ===== CONFIG =====
const VPS_HOST = 'stuffvh.afrihall.com';
const VPS_PORT = 80;
const UUID = 'ee054fe1-9e46-4ef0-8e13-f08f031f7c00';
const VPS_IP = '134.122.51.204';
const PORT = process.env.PORT || 8080;

const XHTTP_PATH = '/';
const XHTTP_MODE = 'auto';
const XHTTP_PADDING = '100-1000';

const HOST_HEADER = 'main-bvxea6i-kmey7d3frhoci.fr-3.platformsh.site';
const SNI = HOST_HEADER;

const ALPN = ['h2', 'http/1.1'];
const FP = 'chrome';

const DOMAIN = process.env.DOMAIN || HOST_HEADER;

// ===== KEEP ALIVE AGENT =====
const agent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 15000,
    maxSockets: 1000,
    maxFreeSockets: 100,
    timeout: 60000
});

// ===== SERVER =====
const server = http.createServer((req, res) => {

    // Health Check
    if (req.url === '/health') {
        res.writeHead(200, {
            'Content-Type': 'application/json'
        });

        return res.end(JSON.stringify({
            status: 'online',
            uptime: process.uptime(),
            memory: process.memoryUsage().rss
        }));
    }

    // Root
    if (req.url === '/') {
        res.writeHead(200, {
            'Content-Type': 'text/plain'
        });

        return res.end('XHTTP Bridge Running\n');
    }

    // Config
    if (
        req.url === '/config' ||
        req.url === `/${UUID}` ||
        req.url === `/${VPS_IP}`
    ) {

        const vlessLink =
`vless://${UUID}@${VPS_HOST}:${VPS_PORT}?type=xhttp&security=tls&path=${XHTTP_PATH}&host=${HOST_HEADER}&mode=${XHTTP_MODE}&x_padding_bytes=${XHTTP_PADDING}&fp=${FP}&alpn=${ALPN.join('%2C')}&sni=${SNI}#Stable-XHTTP`;

        res.writeHead(200, {
            'Content-Type': 'text/plain'
        });

        return res.end(vlessLink + '\n');
    }

    // ===== PROXY =====
    const options = {
        hostname: VPS_HOST,
        port: VPS_PORT,
        path: req.url,
        method: req.method,
        agent,

        headers: {
            ...req.headers,
            host: HOST_HEADER,
            connection: 'keep-alive',
            'x-padding-bytes': XHTTP_PADDING
        }
    };

    const proxyReq = http.request(options, (proxyRes) => {

        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);

        proxyRes.pipe(res, {
            end: true
        });
    });

    // Timeout protection
    proxyReq.setTimeout(30000, () => {
        console.error('Proxy timeout');

        proxyReq.destroy();

        if (!res.headersSent) {
            res.writeHead(504);
        }

        res.end('Gateway Timeout');
    });

    // Error handling
    proxyReq.on('error', (err) => {

        console.error('Proxy Error:', err.message);

        if (!res.headersSent) {
            res.writeHead(502, {
                'Content-Type': 'text/plain'
            });
        }

        res.end('Bad Gateway');
    });

    req.pipe(proxyReq, {
        end: true
    });
});

// ===== SERVER SETTINGS =====
server.keepAliveTimeout = 65000;
server.headersTimeout = 70000;
server.requestTimeout = 30000;
server.timeout = 30000;

// ===== START =====
server.listen(PORT, '0.0.0.0', () => {

    console.log(`Server running on ${PORT}`);
    console.log(`https://${DOMAIN}/config`);
});

// ===== CRASH PROTECTION =====
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received');

    server.close(() => {
        process.exit(0);
    });
});
