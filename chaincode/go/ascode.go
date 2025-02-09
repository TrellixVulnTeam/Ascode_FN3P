package main

import (
	"bytes"
	"fmt"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
	"strconv"
)
type SmartContract struct {}

func (s *SmartContract) Init(APIstub shim.ChaincodeStubInterface) pb.Response {
	return shim.Success(nil)
}

func (s *SmartContract) Invoke(APIstub shim.ChaincodeStubInterface) pb.Response {
	function, args := APIstub.GetFunctionAndParameters()

	if function == "setWallet" {
		return s.setWallet(APIstub, args)
	} else if function == "getWallet" {
		return s.getWallet(APIstub, args)
	} else if function == "setCode" {
		return s.setCode(APIstub, args)
	} else if function == "getCode" {
		return s.getCode(APIstub, args)
	} else if function == "setToken" {
		return s.setToken(APIstub, args)
	}


	fmt.Println("Please check your function : " + function)
	return shim.Error("Unknown function")
}

func main() {
	err := shim.Start(new(SmartContract))
	if err != nil {
		fmt.Printf("Error starting chaincod: %s", err)
	}
}

//wallet struct
type Wallet struct {
	ID string
	coin int
}


//malicious information code struct
type Code struct {
	alias string
	categories string
	submission string
	url string
	risk string
	uploader_ID string
	hash string
}

var wallets []Wallet //user wallet slice

//set wallet
func (s *SmartContract) setWallet(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments.")
	}

	for _, wallet := range wallets {
	   if wallet.ID == args[0] {
	      return shim.Error("Wallet ID has been exists")
	   }
	}

	wallet := Wallet{ID: args[0], coin: 0}
	wallets = append(wallets, wallet)

	return shim.Success(nil)
}


//get wallet
func (s *SmartContract) getWallet(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments.")
	}

	var buffer bytes.Buffer
	var result bool = false

	for _, wallet := range wallets {
		if wallet.ID == args[0]{
			buffer.WriteString("{\"ID\":")
			buffer.WriteString("\"")
			buffer.WriteString(wallet.ID)
			buffer.WriteString("\"")
			buffer.WriteString(",\"coin\":")
			buffer.WriteString("\"")
			buffer.WriteString(strconv.Itoa(wallet.coin))
			buffer.WriteString("\"")
			buffer.WriteString("}")
			result = true
			break
		}
	}

	if result == false {
		return shim.Error("wallets does not exists")
	}

	return shim.Success(buffer.Bytes())
}


var codes []Code//user wallet slice

//set code
func (s *SmartContract) setCode(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	if len(args) != 7 {
		return shim.Error("Incorrect number of arguments.")
	}

	for _, code := range codes {
		if code.hash == args[2] {
			return shim.Error("IPFS hash has been exists")
		}
	}


	code := Code{alias: args[0], categories: args[1], submission: args[2], url: args[3], risk:args[4], uploader_ID: args[5], hash: args[6]}
	codes = append(codes, code)

	var result bool = false

	for index, wallet := range wallets {
		if wallet.ID == args[5] {
			wallets[index].coin += 100
			result = true
		}
	}

	if result == false {
		return shim.Error("wallets does not exists")
	}
		
	return shim.Success(nil)
}


//get code
func (s *SmartContract) getCode(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments.")
	}

	var buffer bytes.Buffer
	var result bool = false

	for _, code := range codes {
		if code.alias == args[0] || code.uploader_ID == args[0] || code.hash == args[0]{
			buffer.WriteString("{\"alias\":")
			buffer.WriteString("\"")
			buffer.WriteString(code.alias)
			buffer.WriteString("\"")
			buffer.WriteString(",\"categories\":")
			buffer.WriteString("\"")
			buffer.WriteString(code.categories)
			buffer.WriteString("\"")
			buffer.WriteString(",\"submission\":")
			buffer.WriteString("\"")
			buffer.WriteString(code.submission)
			buffer.WriteString("\"")
			buffer.WriteString(",\"url\":")
			buffer.WriteString("\"")
			buffer.WriteString(code.url)
			buffer.WriteString("\"")
			buffer.WriteString(",\"risk\":")
			buffer.WriteString("\"")
			buffer.WriteString(code.risk)
			buffer.WriteString("\"")
			buffer.WriteString(",\"uploader\":")
			buffer.WriteString("\"")
			buffer.WriteString(code.uploader_ID)
			buffer.WriteString("\"")
			buffer.WriteString(",\"hash\":")
			buffer.WriteString("\"")
			buffer.WriteString(code.hash)
			buffer.WriteString("\"")
			buffer.WriteString("}/")
			result = true
		}
	}

	if result == false {
		return shim.Error("code does not exists")
	}

	return shim.Success(buffer.Bytes())
}

//get All Code

func (s *SmartContract) setToken(APIstub shim.ChaincodeStubInterface, args []string) pb.Response{

	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments.")
	}

	var result bool = false

	token, _ := strconv.Atoi(args[1])

	for index, wallet := range wallets {
		if wallet.ID == args[0] {
			wallets[index].coin += token
			result = true
		}
	}

	if result == false {
		return shim.Error("wallets does not exists")
	}
	
	return shim.Success(nil)
}
