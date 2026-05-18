// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MembershipNFT} from "../src/MembershipNFT.sol";

contract MembershipNFTTest is Test {
    MembershipNFT nft;
    address owner = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB0B);

    function setUp() public {
        nft = new MembershipNFT("Org", "ORG", "ipfs://m", MembershipNFT.JoinPolicy.Open, owner);
    }

    function test_OpenJoinMintsAndSetsMemberSince() public {
        vm.prank(alice);
        uint256 id = nft.joinOpen();
        assertEq(nft.ownerOf(id), alice);
        assertEq(nft.memberSince(alice), block.timestamp);
    }

    function test_TransferReverts() public {
        vm.prank(alice);
        uint256 id = nft.joinOpen();
        vm.prank(alice);
        vm.expectRevert(MembershipNFT.TransfersDisabled.selector);
        nft.transferFrom(alice, bob, id);
    }

    function test_DoubleJoinReverts() public {
        vm.prank(alice);
        nft.joinOpen();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MembershipNFT.AlreadyMember.selector, alice));
        nft.joinOpen();
    }

    function test_OwnerCanMintForAllowlistPolicy() public {
        nft = new MembershipNFT("Org", "ORG", "ipfs://m", MembershipNFT.JoinPolicy.Allowlist, owner);
        vm.prank(alice);
        vm.expectRevert(MembershipNFT.NotOpen.selector);
        nft.joinOpen();
        vm.prank(owner);
        nft.mintTo(alice);
        assertEq(nft.balanceOf(alice), 1);
    }
}
