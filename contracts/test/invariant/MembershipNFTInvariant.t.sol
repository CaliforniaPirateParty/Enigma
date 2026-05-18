// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, StdInvariant} from "forge-std/Test.sol";
import {MembershipNFT} from "../../src/MembershipNFT.sol";

/// @dev Handler that exercises joinOpen, mintTo (owner), and burn in random order.
contract MembershipHandler is Test {
    MembershipNFT public nft;
    address public owner;
    address[] public actors;

    /// @dev Tracks the token ID minted for each actor (0 = no token).
    mapping(address => uint256) public actorTokenId;

    constructor(MembershipNFT _nft, address _owner) {
        nft = _nft;
        owner = _owner;
        actors.push(address(0xA1));
        actors.push(address(0xA2));
        actors.push(address(0xA3));
        actors.push(address(0xA4));
    }

    function joinOpen(uint256 actorSeed) external {
        address actor = actors[actorSeed % actors.length];
        if (nft.balanceOf(actor) > 0) return;
        vm.prank(actor);
        try nft.joinOpen() returns (uint256 id) {
            actorTokenId[actor] = id;
        } catch {}
    }

    function burnOwn(uint256 actorSeed) external {
        address actor = actors[actorSeed % actors.length];
        uint256 id = actorTokenId[actor];
        if (id == 0 || nft.balanceOf(actor) == 0) return;
        vm.prank(actor);
        try nft.burn(id) {} catch {}
    }

    function burnByOwner(uint256 actorSeed) external {
        address actor = actors[actorSeed % actors.length];
        uint256 id = actorTokenId[actor];
        if (id == 0 || nft.balanceOf(actor) == 0) return;
        vm.prank(owner);
        try nft.burn(id) {} catch {}
    }
}

contract MembershipNFTInvariantTest is StdInvariant, Test {
    MembershipNFT nft;
    MembershipHandler handler;
    address owner = address(0xA11CE);

    address[] actors;

    function setUp() public {
        nft = new MembershipNFT("Org", "ORG", "ipfs://test", MembershipNFT.JoinPolicy.Open, owner);
        handler = new MembershipHandler(nft, owner);
        targetContract(address(handler));

        actors.push(address(0xA1));
        actors.push(address(0xA2));
        actors.push(address(0xA3));
        actors.push(address(0xA4));
    }

    /// @notice Every actor holds at most 1 token at any time.
    function invariant_maxOneTokenPerAddress() public view {
        for (uint256 i; i < actors.length; ++i) {
            assertLe(nft.balanceOf(actors[i]), 1, "actor holds >1 token");
        }
    }

    /// @notice memberSince is zero iff the actor holds no token.
    function invariant_memberSinceConsistency() public view {
        for (uint256 i; i < actors.length; ++i) {
            address actor = actors[i];
            bool hasMembership = nft.balanceOf(actor) == 1;
            bool hasMemberSince = nft.memberSince(actor) != 0;
            assertEq(hasMembership, hasMemberSince, "memberSince/balance mismatch");
        }
    }
}
