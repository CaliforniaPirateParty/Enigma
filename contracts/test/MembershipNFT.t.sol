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

    function test_BurnByHolder() public {
        vm.prank(alice);
        uint256 id = nft.joinOpen();
        vm.prank(alice);
        nft.burn(id);
        assertEq(nft.balanceOf(alice), 0);
        assertEq(nft.memberSince(alice), 0);
    }

    function test_BurnByOwner() public {
        vm.prank(alice);
        uint256 id = nft.joinOpen();
        vm.prank(owner);
        nft.burn(id);
        assertEq(nft.balanceOf(alice), 0);
    }

    function test_BurnByStrangerReverts() public {
        vm.prank(alice);
        uint256 id = nft.joinOpen();
        vm.prank(bob);
        vm.expectRevert("not authorized");
        nft.burn(id);
    }

    function test_SetJoinPolicyOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        nft.setJoinPolicy(MembershipNFT.JoinPolicy.Allowlist);
        vm.prank(owner);
        nft.setJoinPolicy(MembershipNFT.JoinPolicy.Allowlist);
        assertEq(uint8(nft.joinPolicy()), uint8(MembershipNFT.JoinPolicy.Allowlist));
    }

    function test_SetMetadataURIOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        nft.setMetadataURI("ipfs://new");
        vm.prank(owner);
        nft.setMetadataURI("ipfs://new");
        assertEq(nft.metadataURI(), "ipfs://new");
    }

    function test_VotesDelegation() public {
        vm.prank(alice);
        nft.joinOpen();
        vm.prank(alice);
        nft.delegate(alice);
        assertEq(nft.getVotes(alice), 1);
        assertEq(nft.getVotes(bob), 0);
    }

    function test_VotesDelegationToThirdParty() public {
        vm.prank(alice);
        nft.joinOpen();
        vm.prank(alice);
        nft.delegate(bob);
        assertEq(nft.getVotes(alice), 0);
        assertEq(nft.getVotes(bob), 1);
    }

    function test_MintToReverts_NonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        nft.mintTo(bob);
    }

    function test_ApplicationPolicyBehavesLikeAllowlist() public {
        nft = new MembershipNFT("Org", "ORG", "ipfs://m", MembershipNFT.JoinPolicy.Application, owner);
        vm.prank(alice);
        vm.expectRevert(MembershipNFT.NotOpen.selector);
        nft.joinOpen();
        vm.prank(owner);
        nft.mintTo(alice);
        assertEq(nft.balanceOf(alice), 1);
    }
}
