// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OripaX is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    address public minter;

    struct CardData {
        uint256 oripaId;
        uint256 cardNumber;
        uint8 rarity;
        bool isLastOne;
    }

    mapping(uint256 => CardData) public cardData;

    event CardDrawn(
        uint256 indexed tokenId,
        address indexed to,
        uint256 indexed oripaId,
        uint256 cardNumber,
        uint8 rarity
    );

    event LastOneWon(
        uint256 indexed tokenId,
        address indexed winner,
        uint256 indexed oripaId
    );

    event MinterUpdated(address indexed oldMinter, address indexed newMinter);

    modifier onlyMinter() {
        require(msg.sender == minter, "OripaX: caller is not the minter");
        _;
    }

    constructor(address _minter) ERC721("OripaX", "ORIPAX") Ownable(msg.sender) {
        _nextTokenId = 1;
        minter = _minter;
        emit MinterUpdated(address(0), _minter);
    }

    function setMinter(address _minter) external onlyOwner {
        emit MinterUpdated(minter, _minter);
        minter = _minter;
    }

    function mintCard(
        address to,
        uint256 oripaId,
        uint256 cardNumber,
        uint8 rarity,
        string memory uri
    ) external onlyMinter returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        cardData[tokenId] = CardData({
            oripaId: oripaId,
            cardNumber: cardNumber,
            rarity: rarity,
            isLastOne: false
        });

        emit CardDrawn(tokenId, to, oripaId, cardNumber, rarity);
        return tokenId;
    }

    function mintLastOne(
        address to,
        uint256 oripaId,
        string memory uri
    ) external onlyMinter returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        cardData[tokenId] = CardData({
            oripaId: oripaId,
            cardNumber: 0,
            rarity: 255,
            isLastOne: true
        });

        emit LastOneWon(tokenId, to, oripaId);
        return tokenId;
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }
}
