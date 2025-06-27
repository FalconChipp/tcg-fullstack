# Marketplace GraphQL Examples

## Generate proof code
```graphql
mutation { generateProofCode }
```

## Create a listing
```graphql
mutation CreateListing($input: ListingInput!, $code: String!, $img: String!) {
  createMarketplaceListing(input: $input, proofCode: $code, proofImage: $img) {
    id
    status
  }
}
```

You can include `allowOffers: false` in the input to prevent buyers from making offers.
## Browse listings
```graphql
query { browseMarketplaceListings(page:1,pageSize:10){ listings{ id cardId price } } }
```

## Make an offer
```graphql
mutation { makeOffer(input:{ listingId:"LISTING_ID", price:10.0 }) { id status } }
```

## Counter an offer
```graphql
mutation { respondOffer(id:"OFFER_ID", counterPrice:12.0) { id status counterPrice } }
```
