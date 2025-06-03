import IPFSMetadataProvider from "../src/IPFSMetadataProvider";

const networkId = 11155111;
const ipfsEndpoint = "http://localhost:5001";

describe("IPFSMetadataProvider", () => {
    let web3Mock, ipfsProvider;

    beforeEach(() => {
        web3Mock = {
            utils: {
                fromAscii: jest.fn().mockImplementation((str) => `0x${Buffer.from(str).toString("hex")}`),
                hexToUtf8: jest.fn().mockImplementation((hex) => hex),
            },
            eth: {
                Contract: jest.fn().mockImplementation(() => ({
                    methods: {
                        getOrganizationById: jest.fn().mockReturnValue({ call: jest.fn() }),
                        getServiceRegistrationById: jest.fn().mockReturnValue({ call: jest.fn() }),
                    },
                })),
            },
        };

        global.fetch = jest.fn();
        ipfsProvider = new IPFSMetadataProvider(web3Mock, networkId, ipfsEndpoint);
    });

    test("constructor initializes properties correctly", () => {
        expect(ipfsProvider._web3).toBe(web3Mock);
        expect(ipfsProvider._networkId).toBe(networkId);
        expect(ipfsProvider._ipfsEndpoint).toBe(ipfsEndpoint);
        expect(ipfsProvider._registryContract).toBeDefined();
    });

    test("metadata calls _fetchOrgMetadata and _fetchServiceMetadata", async () => {
        jest.spyOn(ipfsProvider, "_fetchOrgMetadata").mockResolvedValueOnce({ groups: [] });
        jest.spyOn(ipfsProvider, "_fetchServiceMetadata").mockResolvedValueOnce({ groups: [] });
        jest.spyOn(ipfsProvider, "_enhanceServiceGroupDetails").mockReturnValueOnce({});

        const result = await ipfsProvider.metadata("org1", "service1");

        expect(ipfsProvider._fetchOrgMetadata).toHaveBeenCalledWith(expect.any(String));
        expect(ipfsProvider._fetchServiceMetadata).toHaveBeenCalledWith(expect.any(String), expect.any(String));
        expect(ipfsProvider._enhanceServiceGroupDetails).toHaveBeenCalled();
        expect(result).toEqual({});
    });

    test("_fetchOrgMetadata fetches org metadata from the registry contract and IPFS", async () => {
        const mockOrgMetadataURI = "mockURI";
        const mockOrgMetadata = { groups: [{ group_id: 'id', group_name: "Group1" }] };

        ipfsProvider._registryContract.methods.getOrganizationById().call.mockResolvedValueOnce({
            orgMetadataURI: mockOrgMetadataURI,
        });
        jest.spyOn(ipfsProvider, "_fetchMetadataFromIpfs").mockResolvedValueOnce(mockOrgMetadata);

        const result = await ipfsProvider._fetchOrgMetadata("mockOrgIdBytes");

        expect(ipfsProvider._registryContract.methods.getOrganizationById).toHaveBeenCalledWith("mockOrgIdBytes");
        expect(ipfsProvider._fetchMetadataFromIpfs).toHaveBeenCalledWith(mockOrgMetadataURI);
        expect(result).toEqual(mockOrgMetadata);
    });

    test("_fetchServiceMetadata fetches service metadata from the registry contract and IPFS", async () => {
        const mockServiceMetadataURI = "mockServiceURI";
        const mockServiceMetadata = { groups: [{ group_id: 'id', group_name: "Group1" }] };

        ipfsProvider._registryContract.methods.getServiceRegistrationById().call.mockResolvedValueOnce({
            metadataURI: mockServiceMetadataURI,
        });
        jest.spyOn(ipfsProvider, "_fetchMetadataFromIpfs").mockResolvedValueOnce(mockServiceMetadata);

        const result = await ipfsProvider._fetchServiceMetadata("mockOrgIdBytes", "mockServiceIdBytes");

        expect(ipfsProvider._registryContract.methods.getServiceRegistrationById).toHaveBeenCalledWith(
            "mockOrgIdBytes",
            "mockServiceIdBytes"
        );
        expect(ipfsProvider._fetchMetadataFromIpfs).toHaveBeenCalledWith(mockServiceMetadataURI);
        expect(result).toEqual(mockServiceMetadata);
    });

    test("_fetchMetadataFromIpfs fetches metadata from IPFS", async () => {
        const mockMetadataURI = "mockIPFSURI";
        const mockCID = "mockCID";
        const mockMetadata = { groups: [{ group_id: 'id', group_name: "Group1" }] };

        jest.spyOn(ipfsProvider, "_getStorageInfoFromURI").mockReturnValueOnce({
            type: ipfsProvider._storageTypeIpfs,
            uri: mockCID,
        });
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValueOnce(mockMetadata),
        });

        const result = await ipfsProvider._fetchMetadataFromIpfs(mockMetadataURI);

        expect(ipfsProvider._getStorageInfoFromURI).toHaveBeenCalledWith(mockMetadataURI);
        expect(global.fetch).toHaveBeenCalledWith(`${ipfsEndpoint}/api/v0/cat?arg=${mockCID}`);
        expect(result).toEqual(mockMetadata);
    });

    test("_enhanceServiceGroupDetails enhances service group details with org group payment info", () => {
        const mockServiceMetadata = {
            groups: [{ group_name: "Group1" }, { group_name: "Group2" }],
        };
        const mockOrgMetadata = {
            groups: [
                { group_name: "Group1", payment: { payment_address: "" } },
                { group_name: "Group2", payment: { payment_address: "" } },
            ],
        };
        const expectedEnhancedMetadata = {
            ...mockServiceMetadata,
            groups: [
                { group_name: "Group1", payment: { payment_address: "" } },
                { group_name: "Group2", payment: { payment_address: "" } },
            ],
        };

        const result = ipfsProvider._enhanceServiceGroupDetails(mockServiceMetadata, mockOrgMetadata);

        expect(result).toEqual(expectedEnhancedMetadata);
    });

    test("_getStorageInfoFromURI parses metadata URI and identifies storage type", () => {
        const mockIpfsURI = `${ipfsProvider._storageUrlIpfsPrefix}mockCID`;
        const mockFilecoinURI = `${ipfsProvider._storageUrlFilecoinPrefix}mockCID`;

        // Test IPFS URI
        const ipfsResult = ipfsProvider._getStorageInfoFromURI(mockIpfsURI);
        expect(ipfsResult).toEqual({
            type: ipfsProvider._storageTypeIpfs,
            uri: "mockCID",
        });

        // Test Filecoin URI
        const filecoinResult = ipfsProvider._getStorageInfoFromURI(mockFilecoinURI);
        expect(filecoinResult).toEqual({
            type: ipfsProvider._storageTypeFilecoin,
            uri: "mockCID",
        });

        // Test unsupported URI
        expect(() => ipfsProvider._getStorageInfoFromURI("unsupportedURI")).toThrow(
            `We support only ${ipfsProvider._storageTypeIpfs} and ${ipfsProvider._storageTypeFilecoin} URI in Registry`
        );
    });

    // Additional tests for other methods follow...
});
