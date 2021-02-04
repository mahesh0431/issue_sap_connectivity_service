onst xsenv = require('@sap/xsenv');
const OAuth2 = require("oauth").OAuth2
const rp = require('request-promise');

var url = require('url');
const WebSocket = require('ws');

xsenv.loadEnv();

const dest_service = xsenv.getServices({ dest: { tag: 'destination' } }).dest;
const uaa_service = xsenv.getServices({ uaa: { tag: 'xsuaa' } }).uaa;
const conn_service = xsenv.getServices({ conn: { tag: 'connectivity' } }).conn;

const proxy_url = 'http://' + conn_service["onpremise_proxy_host"] + ':' + conn_service["onpremise_proxy_port"];

const sUaaCredentials = dest_service.clientid + ':' + dest_service.clientsecret;

async function getAccessToken(clientId, clientSecret, baseUrl) {
    return new Promise((resolve, reject) => {
        const oAuthClient = new OAuth2(clientId, clientSecret, `${baseUrl}/`, "/oauth/authorize", "oauth/token", null)
        oAuthClient.getOAuthAccessToken(
            "",
            { grant_type: "client_credentials" },
            (err, accessToken, refreshToken, results) => {
                if (err) {
                    reject(err)
                }
                resolve(accessToken)
            }
        )
    })
}
getAccessToken(dest_service.clientid, dest_service.clientsecret, uaa_service.url).then(accessTokenForProxy => {
    rp({
        url: dest_service.uri + '/destination-configuration/v1/destinations/EGA_S4S',
        headers: {
            'Authorization': 'Bearer ' + accessTokenForProxy
        }
    }).then(function (data) {

        const oDestination = JSON.parse(data);
        const token = oDestination.authTokens[0];
        const onPremAuth = `${token.type} ${token.value}`;

        getAccessToken(conn_service.clientid, conn_service.clientsecret, uaa_service.url).then(connToken => {

            rp({
                uri: oDestination.destinationConfiguration.URL + '/sap/opu/odata/sap/ZTESTCDSF4HELP_CDS/T001',
                proxy: proxy_url,
                headers: {
                    'Authorization': onPremAuth,
                    'Proxy-Authorization': 'Bearer ' + connToken
                }
            }).then(function (a, b, c) {
                console.log(a);
            }).catch((error) => {
                console.log(error);
            });
        });
    });
});
