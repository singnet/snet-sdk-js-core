import RegistryNetworks from 'singularitynet-platform-contracts/networks/Registry.json';
import RegistryAbi from 'singularitynet-platform-contracts/abi/Registry.json';
import { logMessage } from './utils';
import {
    LIGHTHOUSE_ENDPOINT,
    STORAGE_TYPE_FILECOIN,
    STORAGE_TYPE_IPFS,
    STORAGE_URL_FILECOIN_PREFIX,
    STORAGE_URL_IPFS_PREFIX
} from './constants';

export default class IPFSMetadataProvider {
    constructor(web3, networkId, ipfsEndpoint, tokenName, standName) {
        this._web3 = web3;
        this._networkId = networkId;
        this._ipfsEndpoint = ipfsEndpoint;
        this._lighthouseEndpoint = LIGHTHOUSE_ENDPOINT;
        this._storageTypeIpfs = STORAGE_TYPE_IPFS;
        this._storageTypeFilecoin = STORAGE_TYPE_FILECOIN;
        this._storageUrlIpfsPrefix = STORAGE_URL_IPFS_PREFIX;
        this._storageUrlFilecoinPrefix = STORAGE_URL_FILECOIN_PREFIX;
        const registryAddress = RegistryNetworks[this._networkId][tokenName][standName].address;
        this._registryContract = new this._web3.eth.Contract(
            RegistryAbi,
            registryAddress
        );
    }

    /**
     * @param {string} orgId
     * @param {string} serviceId
     * @returns {Promise.<ServiceMetadata>}
     */
    async getMetadata(orgId, serviceId) {
        logMessage('debug', 'MetadataProvider', `Fetching service metadata [org: ${orgId} | service: ${serviceId}]`);

        let orgIdBytes = this._web3.utils.fromAscii(orgId);
        orgIdBytes = orgIdBytes.padEnd(66, '0'); // 66 = '0x' + 64 hex characters        

        let serviceIdBytes = this._web3.utils.fromAscii(serviceId);
        serviceIdBytes = serviceIdBytes.padEnd(66, '0'); // 66 = '0x' + 64 hex characters

        try {
            const orgMetadata = await this._fetchOrgMetadata(orgIdBytes);

            const serviceMetadata = await this._fetchServiceMetadata(
                orgIdBytes,
                serviceIdBytes
            );

            return Promise.resolve(
                this._enhanceServiceGroupDetails(serviceMetadata, orgMetadata)
            );
        } catch (error) {
            throw error;
        }
    }

    async _fetchOrgMetadata(orgIdBytes) {
        logMessage('debug', 'MetadataProvider', 'Fetching org metadata URI from registry contract');

        try {
            const { orgMetadataURI } = await this._registryContract.methods.getOrganizationById(orgIdBytes).call();

            return this._fetchMetadataFromIpfs(orgMetadataURI);
        } catch (error) {
            throw error;
        }
    }

    async _fetchServiceMetadata(orgIdBytes, serviceIdBytes) {
        logMessage('debug', 'MetadataProvider', 'Fetching service metadata URI from registry contract');

        try {
            const { metadataURI: serviceMetadataURI } =
                await this._registryContract.methods.getServiceRegistrationById(orgIdBytes, serviceIdBytes).call();
            return this._fetchMetadataFromIpfs(serviceMetadataURI);
        } catch (error) {
            throw new Error('fetching service metadata error: ', error);
        }
    }

    async _fetchMetadataFromIpfs(metadataURI) { 
        if (metadataURI === "0x") {
            throw new Error("Metadata is not defined in Registry")
        }
        try {
            let storageInfo = this._getStorageInfoFromURI(metadataURI);
            let storageCID = storageInfo.uri;
            storageCID = storageCID.replace(/\0/g, '');
            logMessage('debug', 'MetadataProvider', `Fetching metadata [CID: ${storageCID}]`);
            let fetchUrl;
            if (storageInfo.type === this._storageTypeIpfs) {
                fetchUrl = `${this._ipfsEndpoint}/api/v0/cat?arg=${storageCID}`;
            } else {
                fetchUrl = `${this._lighthouseEndpoint}/${storageCID}`;
            }
            const response = await fetch(fetchUrl);
            if (!response.ok) {
                throw response.error;
            }
            return response.json();
        } catch (error) {
            logMessage('error', 'MetadataProvider', `Error fetching metadata [CID: ${storageCID}] ${error?.message}`);
            throw error;
        }
    }

    _enhanceServiceGroupDetails(serviceMetadata, orgMetadata) {
        const { groups: orgGroups } = orgMetadata;
        const { groups: serviceGroups } = serviceMetadata;

        const groups = serviceGroups.map((group) => {
            const { group_name: serviceGroupName } = group;
            const orgGroup = orgGroups.find(
                ({ group_name: orgGroupName }) =>
                    orgGroupName === serviceGroupName
            );
            return {
                ...group,
                payment: orgGroup.payment,
            };
        });

        return { serviceMetadata: { ...serviceMetadata, groups }, orgMetadata };
    }

    _getStorageInfoFromURI(metadataURI) {
        const decodedUri = this._web3.utils.hexToUtf8(metadataURI);
        if (decodedUri.startsWith(STORAGE_URL_IPFS_PREFIX)) {
            return { type: this._storageTypeIpfs, uri: decodedUri.replace(this._storageUrlIpfsPrefix, "") };
        } else if (decodedUri.startsWith(STORAGE_URL_FILECOIN_PREFIX)) {
            return { type: this._storageTypeFilecoin, uri: decodedUri.replace(this._storageUrlFilecoinPrefix, "") };
        } else {
            throw new Error(`We support only ${this._storageTypeIpfs} and ${this._storageTypeFilecoin} URI in Registry`);
        }
    }
}
