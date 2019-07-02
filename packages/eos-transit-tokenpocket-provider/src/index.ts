import { Api, JsonRpc, ApiInterfaces, RpcInterfaces } from 'eosjs';
import { WalletProvider, NetworkConfig, WalletAuth, DiscoveryOptions } from 'eos-transit';
// import { SignatureProvider } from 'eosjs/dist/eosjs-api-interfaces';

let accountPublickey: string;
let scatter: any;
let signatureProvider: ApiInterfaces.SignatureProvider;
 
if (typeof window !== undefined && typeof document !== undefined) {
	// @ts-ignore:
	scatter = window.scatter;
	document.addEventListener('scatterLoaded', () => {
		// @ts-ignore:
		scatter = window.scatter;
	});
}

function logIfDebugEnabled(msg: string) {
	const debug = localStorage.getItem('DEBUG');
	if (debug === 'true') {
		console.log('IN WALLET: ' + msg);
	}
}

function discover(discoveryOptions: DiscoveryOptions) {
	logIfDebugEnabled('The discover() method of myWallet was called');

	// You probably do not need to implement this method.

	return new Promise((resolve, reject) => {
		const discoveryInfo = {
			keys: [],
			note: 'Wallet does not support discovery'
		};

		resolve(discoveryInfo);
	});
}

function signArbitrary(data: string, userMessage: string): Promise<string> {
	return scatter.getArbitrarySignature(accountPublickey, data, userMessage);
}

export function tokenpocketWalletProvider() {
	return function makeWalletProvider(network: NetworkConfig): WalletProvider {
		// connection
		function connect(appName: string) {
			logIfDebugEnabled('In wallet connect');
			return new Promise((resolve, reject) => {
				let tries = 0;

				function checkConnect() {
					logIfDebugEnabled('Checking the state of Scatter Object: ' + tries + ' : ' + scatter);
					if (scatter) return resolve(true);

					tries++;

					if (tries > 5) return reject('Cannot connect to TokenPocket wallet provider');

					setTimeout(() => {
						checkConnect();
					}, 1000);
				}

				checkConnect();
			});
		}

		function disconnect(): Promise<any> {
			scatter.disconnect();
			return Promise.resolve(true);
		}

		// Authentication
		async function login(accountName?: string): Promise<WalletAuth> {
			logIfDebugEnabled('In login. Scatter object: ' + JSON.stringify(scatter));

			try {
				const identity = await scatter.getIdentity({ accounts: [ { ...network, blockchain: 'eos' } ] });
				if (!identity) {
					return Promise.reject('No identity obtained from Scatter');
				}
				const account =
					(identity &&
						identity.accounts &&
						(identity.accounts as any[]).find((x) => x.blockchain === 'eos')) ||
					void 0;

				logIfDebugEnabled('account2:' + account);
				if (!account) {
					return Promise.reject('No account data obtained from Scatter identity');
				}

				accountPublickey = account.publicKey;
				logIfDebugEnabled('accountName:' + account.name);
				return {
					accountName: account.name,
					permission: account.authority,
					publicKey: accountPublickey
				};
			} catch (error) {
				logIfDebugEnabled('error:' + error);
				console.log('[Token Pocket]', error);
				return Promise.reject(error);
			}
		}

		function logout(accountName?: string): Promise<boolean> {
			return scatter.forgetIdentity();
		}

		const walletProvider: WalletProvider = {
			id: 'TokenPocket',
			meta: {
				name: 'TokenPocket',
				shortName: 'TP',
				description: 'TokenPocket is multi-chain mobile wallet that is easy and safe to use.'
			},
			signatureProvider: {
				async getAvailableKeys() {
					logIfDebugEnabled('In getAvailableKeys new1');
					logIfDebugEnabled('Return Key: ' + accountPublickey);
					const arr: string[] = [ accountPublickey ];
					return arr;
				},

				async sign(
					signatureProviderArgs: ApiInterfaces.SignatureProviderArgs
				): Promise<RpcInterfaces.PushTransactionArgs> {
					logIfDebugEnabled('In Sign method');
					if (!signatureProvider) {
						logIfDebugEnabled('signatureProvider not yet created. Creating.');
						if (scatter.hasOwnProperty('hookProvider')) {
							const rpc = new JsonRpc(network.protocol + '://' + network.host + ':' + network.port);
							// @ts-ignore:
							const api = new Api({ rpc });
							signatureProvider = await scatter.hookProvider(network, {}, true, api);
						}
					}

					return signatureProvider.sign(signatureProviderArgs);
				}
			},
			connect,
			discover,
			disconnect,
			login,
			logout,
			signArbitrary
		};

		return walletProvider;
	};
}

export default tokenpocketWalletProvider;
