pragma solidity ^0.4.11;


import './ERC20Basic.sol';


/*
 * ERC20 interface
 * see https://github.com/ethereum/EIPs/issues/20
 */
contract ERC20 is ERC20Basic {
  // active supply of tokens
  uint public activeSupply;
  function allowance(address owner, address spender) constant returns (uint);
  function transferFrom(address from, address to, uint value) returns (bool);
  function approve(address spender, uint value);
  event Approval(address indexed owner, address indexed spender, uint value);
}
