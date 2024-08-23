const {COSESign1, Label, COSEKey, Int, BigNum} = require("@emurgo/cardano-message-signing-nodejs");
const {Address, PublicKey, Ed25519Signature, RewardAddress} = require("@emurgo/cardano-serialization-lib-nodejs");
const {Buffer} = require("buffer");
const express = require("express");
const {whiteList} = require("config");
const app = express();
app.use(express.json());
app.listen(8081, () => console.log("Listening on port 8081"));
module.exports = app;

/**
 * @route /
 * @verb GET
 */
app.get('/', (req, res) => {
    res.send('Cardano Connect Verify API')
})

/**
 * @route /verify
 * @verb POST
 * @param {{ stake_address: string; message: string; key: string; signature: string; }}
 */
app.post("/verify", async (req, res) => {
    const { stake_address, message, key, signature } = req.body
    if (!stake_address || !message || !key || !signature) {
        res.send({
            success: false,
            message: 'Invalid post data expected: { stake_address: string; message: string; key: string; signature: string; }'
        })
    } else {
        res.send(
            await verifySignedData(
                stake_address,
                message,
                {key, signature}
            )
        )
    }
});

/**
 * Verify if the stakeAddress signed the expectedPayload.
 * We also check against the whiteList.
 * @param stakeAddress {string}
 * @param expectedPayload {string}
 * @param signedData {{ key: string; signature: string }}
 * @returns {Promise<{success: boolean, message: string}|{success: (false|boolean|boolean), message: string}>}
 */
const verifySignedData = async (stakeAddress, expectedPayload, signedData) => {
    try {
        const decoded = COSESign1.from_bytes(Buffer.from(signedData.signature, "hex"));
        const headers = decoded.headers().protected().deserialized_headers();
        const address = Address.from_bytes(Buffer.from(
            Buffer.from(headers.header(Label.new_text("address")).to_bytes())
                .toString("hex")
                .substring(4),
            "hex"
        ));

        const key = COSEKey.from_bytes(Buffer.from(signedData.key, "hex"));
        const pubKeyBytes = key.header(Label.new_int(Int.new_negative(BigNum.from_str("2")))).as_bytes();
        const publicKey = PublicKey.from_bytes(pubKeyBytes);

        const payload = decoded.payload();
        const signature = Ed25519Signature.from_bytes(decoded.signature());
        const receivedData = decoded.signed_data().to_bytes();

        const signerStakeAddress = RewardAddress.from_address(address).to_address().to_bech32();
        const comparePayload = Buffer.from(payload, 'hex').toString();

        const isSigned = publicKey.verify(receivedData, signature);
        const isPayloadMatched = comparePayload === expectedPayload;
        const isAddressMatched = signerStakeAddress === stakeAddress;
        const isWhitelisted = whiteList.length
            ? whiteList.includes(signerStakeAddress)
            : true;

        let error
        if (!isSigned) {
            error = 'Signature mismatch'
        }
        if (!isPayloadMatched) {
            error = 'Payload mismatch'
        }
        if (!isAddressMatched) {
            error = 'Address mismatch'
        }
        if (!isWhitelisted) {
            error = 'Whitelist mismatch'
        }

        return {
            success: !error,
            message: error || 'Verified'
        }
    } catch (e) {
        return {
            success: false,
            message: 'Unverified: ' + e.message
        }
    }
}
