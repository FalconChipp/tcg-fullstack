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

## Browse listings
```graphql
query { browseMarketplaceListings(page:1,pageSize:10){ listings{ id cardId price } } }
```

## Make an offer
```graphql
mutation { makeOffer(input:{ listingId:"LISTING_ID", price:10.0 }) { id status } }
```
