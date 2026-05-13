export const PROJECT_STATUS_FOR_ISSUE_QUERY = `
  query ProjectStatusForIssue($owner: String!, $repo: String!, $itemNumber: Int!, $statusFieldName: String!, $projectItemsCursor: String) {
    repository(owner: $owner, name: $repo) {
      issue(number: $itemNumber) {
        projectItems(first: 100, after: $projectItemsCursor) {
          nodes {
            id
            project {
              id
              number
              owner {
                ... on Organization {
                  login
                }
                ... on User {
                  login
                }
              }
            }
            fieldValueByName(name: $statusFieldName) {
              __typename
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                optionId
                field {
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

export const PROJECT_STATUS_FOR_PULL_REQUEST_QUERY = `
  query ProjectStatusForPullRequest($owner: String!, $repo: String!, $itemNumber: Int!, $statusFieldName: String!, $projectItemsCursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $itemNumber) {
        projectItems(first: 100, after: $projectItemsCursor) {
          nodes {
            id
            project {
              id
              number
              owner {
                ... on Organization {
                  login
                }
                ... on User {
                  login
                }
              }
            }
            fieldValueByName(name: $statusFieldName) {
              __typename
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                optionId
                field {
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

export const PROJECT_STATUS_FIELDS_QUERY = `
  query ProjectStatusFields($projectId: ID!, $fieldsCursor: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        fields(first: 100, after: $fieldsCursor) {
          nodes {
            __typename
            ... on ProjectV2SingleSelectField {
              id
              name
              options {
                id
                name
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

export const PROJECT_BY_OWNER_AND_NUMBER_QUERY = `
  query ProjectByOwnerAndNumber($login: String!, $number: Int!) {
    repositoryOwner(login: $login) {
      ... on Organization {
        projectV2(number: $number) {
          id
        }
      }
      ... on User {
        projectV2(number: $number) {
          id
        }
      }
    }
  }
`;
