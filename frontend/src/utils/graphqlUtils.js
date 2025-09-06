/**
 * Collection-related GraphQL mutations 
 * utils/graphqlUtils.js
 */
export const COLLECTION_MUTATIONS = {
  ADD_CARD: `
    mutation AddToCollection(
      $cardId: String!,
      $quantity: Int,
      $condition: String,
      $variation: String,
      $wishlist: Boolean,
      $isPublic: Boolean
    ) {
      addToCollection(
        cardId: $cardId,
        quantity: $quantity,
        condition: $condition,
        variation: $variation,
        wishlist: $wishlist,
        isPublic: $isPublic
      ) {
        id
        cardId
        quantity
        condition
        variation
        wishlist
        isPublic
        createdAt
        updatedAt
      }
    }
  `,
  UPDATE_CARD: `
    mutation UpdateCollectionCard($input: UpdateCollectionCardInput!) {
      updateCollectionCard(input: $input) {
        collectionCard {
          id
          cardId
          quantity
          condition
          variation
          isPublic
          wishlist
        }
      }
    }
  `,

  // ----- BINDER MUTATIONS -----
  CREATE_BINDER: `
    mutation CreateBinder($input: BinderInput!) {
      createBinder(input: $input) {
        id
        name
        description
        accentColor
        coverColor     # <-- changed from coverImage to coverColor
        visibility
        slug
        createdAt
        updatedAt
        pages {
          id
          title
          layout
          pageOrder
          slots {         # <-- include slots for proper hydration
            id
            cardId
            position
            quantity
            notes
          }
        }
      }
    }
  `,

  UPDATE_BINDER: `
    mutation UpdateBinder($id: ID!, $input: BinderInput!) {
      updateBinder(id: $id, input: $input) {
        id
        name
        description
        accentColor
        coverColor
        visibility
        slug
        createdAt
        updatedAt
        pages {
          id
          title
          layout
          pageOrder
          slots {
            id
            cardId
            position
            quantity
            notes
          }
        }
      }
    }
  `,

  // --- NEW: Add card to binder slot (for saving slots) ---
  ADD_CARD_TO_BINDER: `
    mutation AddCardToBinder($pageId: ID!, $input: BinderSlotInput!) {
      addCardToBinder(pageId: $pageId, input: $input) {
        id
        pageId
        cardId
        position
        quantity
        notes
      }
    }
  `,

  // --- NEW: Batch Save All Binder Pages & Slots ---
  SAVE_BINDER_PAGES_AND_SLOTS: `
    mutation SaveBinderPagesAndSlots($binderId: ID!, $pages: [BinderPageInput!]!) {
      saveBinderPagesAndSlots(binderId: $binderId, pages: $pages) {
        id
        name
        description
        accentColor
        coverColor
        visibility
        slug
        createdAt
        updatedAt
        pages {
          id
          title
          layout
          pageOrder
          slots {
            id
            cardId
            position
            quantity
            notes
          }
        }
      }
    }
  `,

  // (If you have update/delete slot mutations, add here as needed)
};

/**
 * Execute a GraphQL mutation
 * @param {string} mutation - The GraphQL mutation string
 * @param {Object} variables - Variables for the mutation
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} The response data or error
 */
const GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;

export async function executeMutation(mutation, variables, token) {
  try {
    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        query: mutation,
        variables: variables
      })
    });

    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response:', text.substring(0, 500)); // Log first 500 chars
      throw new Error('Received invalid response from server');
    }

    const result = await response.json();

    if (!response.ok) {
      console.error('GraphQL Error Response:', result);
      throw new Error(result.message || `HTTP error! status: ${response.status}`);
    }

    if (result.errors) {
      console.error('GraphQL Errors:', result.errors);
      throw new Error(result.errors[0]?.message || 'Failed to execute mutation');
    }

    return result.data || result; // Some GraphQL servers return data at the root
  } catch (error) {
    console.error('Mutation error:', error);
    // Rethrow with more context if needed
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error('Unable to connect to the server. Please check your internet connection.');
    }
    throw error;
  }
}

/**
 * Format card data for collection
 * @param {Object} card - The card data from the API
 * @returns {Object} Formatted card data for the collection
 */
export function formatCardForCollection(card) {
  return {
    cardId: card.cardId || card.externalId || card.id || '',
    name: card.name || card.tcgName || '',
    setName: card.setName || card.tcgSetName || '',
    image: card.image || card.tcgImageUrl || '',
    setSymbol: card.setSymbol || card.tcgSetSymbolUrl || '',
    rarity: card.rarity || card.tcgRarity || '',
    number: card.number || card.number || '',
    pricing: card.pricing || {},
    variations: card.variations || {}
  };
}

// utils/graphqlUtils.js

export const WISHLIST_QUERIES = {
  MY_WISHLIST: `
    query MyWishlist($page: Int, $pageSize: Int) {
      myWishlist(page: $page, pageSize: $pageSize) {
        entries {
          id
          cardId
          variation
          quantity
          notes
          createdAt
          updatedAt
          card {
            id
            name
            image
            setName
            number
          }
        }
        total
        page
        pageSize
      }
    }
  `,
  USER_WISHLIST: `
    query Wishlist($userId: ID!, $page: Int, $pageSize: Int) {
      wishlist(userId: $userId, page: $page, pageSize: $pageSize) {
        entries {
          id
          cardId
          variation
          quantity
          notes
          createdAt
          updatedAt
          card {
            id
            name
            image
            setName
            number
          }
        }
        total
        page
        pageSize
      }
    }
  `,
};

// Reuse your POST runner for queries too
export async function executeQuery(query, variables, token) {
  return executeMutation(query, variables, token);
}
