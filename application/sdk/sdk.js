'use strict';
const {FileSystemWallet, Gateway} = require('fabric-network');
var path = require('path');
const ccpPath = path.resolve(__dirname, '../config/','connection.json');
//console.log(ccpPath)

async function send(type, func, args) {
    try{
        const walletPath = path.join(__dirname,'../config/','wallet');
        console.log(walletPath)
        const wallet = new FileSystemWallet(walletPath);
        console.log('Wallet Path: '+ walletPath);
        const userExists = await wallet.exists('user1');
        if(!userExists){
            console.log('An identity for the user "user1" does not exist in the wallet');
            console.log('Run the registUser.js application before retrying');
            return;
        }
        const gateway = new Gateway();
        await gateway. connect(ccpPath, {wallet, identity: 'user1', discovery: {enabled: true, asLocalhost: true}});
        const network = await gateway.getNetwork('channelmalware');
        const contract = network.getContract('ascd-cc');
        if(type){
            await contract.submitTransaction(func, ...args);
            console.log('Transaction has been submitted');
            //return "200"
        }else{
            const result = await contract.evaluateTransaction(func, ...args);
            console.log(`Transaction has been evaluates`)
            return result.toString()
        }
    } catch (error){
        console.error(`Failed to submit transaction: ${error}`);
        //return error
    }
}
module.exports = {
    send:send
}