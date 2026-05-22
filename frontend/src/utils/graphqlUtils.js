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
      $variation: String
    ) {
      addToCollection(
        cardId: $cardId,
        quantity: $quantity,
        condition: $condition,
        variation: $variation
      ) {
        id
        cardId
        quantity
        condition
        variation
        wishlist
        createdAt
        updatedAt
      }
    }
  `,
  UPDATE_CARD: `
    mutation UpdateCollectionEntry(
      $cardId: String!,
      $quantity: Int,
      $condition: String,
      $variation: String
    ) {
      updateCollectionEntry(
        cardId: $cardId,
        quantity: $quantity,
        condition: $condition,
        variation: $variation
      ) {
        id
        cardId
        quantity
        condition
        variation
        wishlist
        createdAt
        updatedAt
      }
    }
  `,

  CREATE_BINDER: `
    mutation CreateBinder($input: BinderInput!) {
      createBinder(input: $input) {
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
};

/**
 * Execute a GraphQL mutation
 * @param {string} mutation - The GraphQL mutation string
 * @param {Object} variables - Variables for the mutation
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} The response data or error
 */
import { getGraphqlUrl } from "@/utils/apiClient";
import { devError } from "@/utils/devLog";

// CHANGED: canonical Cardsearch fragments for shared queries
export const CARDSEARCH_FRAGMENTS = {
  MIN: `
    fragment CardsearchMin on CardsearchCard {
      id
      name
      number
      setCode
      images { small large }
      variants { key label default }
    }
  `,
  DETAIL: `
    fragment CardsearchDetail on CardsearchCard {
      id
      name
      number
      setCode
      images { small large }
      variants { key label default }
      latestPrices { provider currency market mid low high gbp updatedAt }
      priceRollups(window: "30d") { window min max avg last updatedAt }
    }
  `,
};

// CHANGED: core search queries leveraging canonical fragments
export const CARDSEARCH_QUERIES = {
  SEARCH: `
    query Cardsearch($input: CardsearchInput!) {
      cardsearch(input: $input) {
        total
        items { ...CardsearchMin }
      }
    }
    ${CARDSEARCH_FRAGMENTS.MIN}
  `,
  BY_ID: `
    query CardsearchCardById($id: ID!, $variant: String) {
      cardsearchCard(id: $id, variant: $variant) { ...CardsearchDetail }
    }
    ${CARDSEARCH_FRAGMENTS.DETAIL}
  `,
};

export async function executeMutation(mutation, variables, token) {
  try {
    const response = await fetch(getGraphqlUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        query: mutation,
        variables
      })
    });

    let resultText = null;
    let resultJson = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      resultJson = await response.json();
    } else {
      resultText = await response.text();
    }

    const extractErrorMessage = () => {
      if (resultJson?.errors?.length) {
        const first = resultJson.errors[0];
        return first?.message || first?.extensions?.message;
      }
      if (resultJson?.message) return resultJson.message;
      if (resultText) return resultText;
      return null;
    };

    if (!response.ok) {
      const message = extractErrorMessage();
      devError('GraphQL Error Response:', resultJson ?? resultText);
      throw new Error(message || `HTTP error! status: ${response.status}`);
    }

    if (resultJson?.errors) {
      devError('GraphQL Errors:', resultJson.errors);
      throw new Error(extractErrorMessage() || 'Failed to execute mutation');
    }

    return resultJson?.data || resultJson;
  } catch (error) {
    devError('Mutation error:', error);
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error('Unable to connect to the server. Please check your internet connection.');
    }
    throw error;
  }
}

// CHANGED: tolerant mapper across legacy + canonical card responses
export function formatCardForCollection(card) {
  return {
    cardId: card.cardId || card.externalId || card.id || '',
    name: card.name || card.tcgName || '',
    setCode: card.setCode || card.set?.code || '',
    setName: card.set?.name || card.setName || card.tcgSetName || '',
    image:
      (card.images && (card.images.large || card.images.small)) ||
      card.image ||
      card.tcgImageUrl ||
      '',
    setSymbol: card.setSymbol || card.tcgSetSymbolUrl || '',
    rarity: card.rarity || card.tcgRarity || '',
    number: card.number || '',
    pricing: card.latestPrices || card.pricing || {},
    variations: card.variants || card.variations || {}
  };
}

// CHANGED: wishlist queries with canonical Cardsearch fields + compat variants
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
            number
            setCode
            images { small large }
            variants { key label default }
            latestPrices { provider currency market mid low high gbp updatedAt }
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
            number
            setCode
            images { small large }
            variants { key label default }
            latestPrices { provider currency market mid low high gbp updatedAt }
          }
        }
        total
        page
        pageSize
      }
    }
  `,
  MY_WISHLIST_CARDSEARCH: `
    query MyWishlistCardsearch($page: Int, $pageSize: Int) {
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
            number
            setCode
            images { small large }
            variants { key label default }
            latestPrices { provider currency market mid low high gbp updatedAt }
          }
        }
        total
        page
        pageSize
      }
    }
  `,
  USER_WISHLIST_CARDSEARCH: `
    query WishlistCardsearch($userId: ID!, $page: Int, $pageSize: Int) {
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
            number
            setCode
            images { small large }
            variants { key label default }
            latestPrices { provider currency market mid low high gbp updatedAt }
          }
        }
        total
        page
        pageSize
      }
    }
  `,
};

/* Reuse POST runner for queries too */
export async function executeQuery(query, variables, token) {
  return executeMutation(query, variables, token);
}
