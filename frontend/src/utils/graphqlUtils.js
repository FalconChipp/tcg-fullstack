/**
 * Collection-related GraphQL mutations 
 * utils/graphqlUtils.js
 */
export const COLLECTION_MUTATIONS = {
  ADD_CARD: `
    mutation AddCardToCollection($input: AddCardToCollectionInput!) {
      addCardToCollection(input: $input) {
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

  SAVE_BINDER: `
    mutation SaveBinder($input: BinderInput!) {
      saveBinder(input: $input) {
        id
        name
        layout
        pages {
          page
          position
          cardId
        }
      }
    }
  `
};

/**
 * Execute a GraphQL mutation
 * @param {string} mutation - The GraphQL mutation string
 * @param {Object} variables - Variables for the mutation
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} The response data or error
 */
const GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

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
