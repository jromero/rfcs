import {
  extractIssuesFromBotComment,
  generateBotComment
} from '../src/bot-comment'

describe('#generateBotComment', function () {
  describe('no previous comment exists', function () {
    test('no amendments', async () => {
      let [updatedComment, errors] = generateBotComment([], [])

      expect(errors).toHaveLength(0)
      expect(updatedComment).toMatch(`Maintainers,

As you review this RFC please queue up issues to be created using the following commands:

    queue-issue <repo> "<title>" [labels]...
    unqueue-issue <uid>

### Issues

__(none)__
`)
    })

    test('with additions', async () => {
      let [updatedComment, errors] = generateBotComment(
        [],
        [
          {
            op: 'addition',
            issue: {
              repo: 'org/repo1',
              title: 'Issue 1',
              labels: []
            }
          },
          {
            op: 'addition',
            issue: {
              repo: 'org/repo2',
              title: 'Issue 2',
              labels: ['label-1'],
              num: 9
            }
          }
        ]
      )

      expect(errors).toHaveLength(0)
      expect(updatedComment).toMatch(`Maintainers,

As you review this RFC please queue up issues to be created using the following commands:

    queue-issue <repo> "<title>" [labels]...
    unqueue-issue <uid>

### Issues

  * ⬜️ 14b156 - org/repo1 "Issue 1"
  * ✅ d1dc9d - org/repo2#9 "Issue 2" [label-1]
`)
    })
  })

  describe('previous comment exists', function () {
    test('adding an issue', function () {
      let [updatedComment, errors] = generateBotComment(
        [
          {
            uid: '14b156',
            repo: 'org/repo1',
            title: 'Issue 1',
            labels: []
          },
          {
            uid: 'd1dc9d',
            repo: 'org/repo2',
            title: 'Issue 2',
            labels: ['label-1']
          }
        ],
        [
          {
            op: 'addition',
            issue: {
              repo: 'org/repo3',
              title: 'Issue 3',
              labels: ['label-1', 'label 2']
            }
          },
          {
            op: 'creation',
            uid: 'd1dc9d',
            num: 2
          }
        ]
      )

      expect(errors).toHaveLength(0)
      expect(updatedComment).toMatch(`Maintainers,

As you review this RFC please queue up issues to be created using the following commands:

    queue-issue <repo> "<title>" [labels]...
    unqueue-issue <uid>

### Issues

  * ⬜️ 14b156 - org/repo1 "Issue 1"
  * ✅ d1dc9d - org/repo2#2 "Issue 2" [label-1]
  * ⬜️ cf07a9 - org/repo3 "Issue 3" [label-1][label 2]
`)
    })

    describe('remove', function () {
      test('issue', function () {
        let [updatedComment, errors] = generateBotComment(
          [
            {
              uid: '14b156',
              repo: 'org/repo1',
              title: 'Issue 1',
              labels: []
            },
            {
              uid: 'd1dc9d',
              repo: 'org/repo2',
              title: 'Issue 2',
              labels: ['label-1']
            }
          ],
          [
            {
              op: 'removal',
              uid: '14b156'
            }
          ]
        )

        expect(errors).toHaveLength(0)
        expect(updatedComment).toMatch(`Maintainers,

As you review this RFC please queue up issues to be created using the following commands:

    queue-issue <repo> "<title>" [labels]...
    unqueue-issue <uid>

### Issues

  * ⬜️ d1dc9d - org/repo2 "Issue 2" [label-1]
`)
      })

      test('non-existent issue', function () {
        let [updatedComment, errors] = generateBotComment(
          [
            {
              uid: '14b156',
              repo: 'org/repo1',
              title: 'Issue 1',
              labels: []
            },
            {
              uid: 'd1dc9d',
              repo: 'org/repo2',
              title: 'Issue 2',
              labels: ['label-1']
            }
          ],
          [
            {
              op: 'removal',
              uid: 'non-existent'
            }
          ]
        )

        expect(errors).toHaveLength(1)
        expect(errors[0].message).toMatch(
          `Issue with uid 'non-existent' not found!`
        )
        expect(updatedComment).toMatch(`Maintainers,

As you review this RFC please queue up issues to be created using the following commands:

    queue-issue <repo> "<title>" [labels]...
    unqueue-issue <uid>

### Issues

  * ⬜️ 14b156 - org/repo1 "Issue 1"
  * ⬜️ d1dc9d - org/repo2 "Issue 2" [label-1]
`)
      })

      test('already created issue', function () {
        let [updatedComment, errors] = generateBotComment(
          [
            {
              uid: '14b156',
              repo: 'org/repo1',
              title: 'Issue 1',
              labels: [],
              num: 1
            },
            {
              uid: 'd1dc9d',
              repo: 'org/repo2',
              title: 'Issue 2',
              labels: ['label-1']
            }
          ],
          [
            {
              op: 'removal',
              uid: '14b156'
            }
          ]
        )

        expect(errors).toHaveLength(1)
        expect(errors[0].message).toMatch(
          `Cannot unqueue '14b156' since it was already created!`
        )
        expect(updatedComment).toMatch(`Maintainers,

As you review this RFC please queue up issues to be created using the following commands:

    queue-issue <repo> "<title>" [labels]...
    unqueue-issue <uid>

### Issues

  * ✅ 14b156 - org/repo1#1 "Issue 1"
  * ⬜️ d1dc9d - org/repo2 "Issue 2" [label-1]
`)
      })
    })

    describe('create', function () {
      test('issue', function () {
        let [updatedComment, errors] = generateBotComment(
          [
            {
              uid: '14b156',
              repo: 'org/repo1',
              title: 'Issue 1',
              labels: []
            },
            {
              uid: 'd1dc9d',
              repo: 'org/repo2',
              title: 'Issue 2',
              labels: ['label-1']
            }
          ],
          [
            {
              op: 'creation',
              uid: 'd1dc9d',
              num: 2
            }
          ]
        )

        expect(errors).toHaveLength(0)
        expect(updatedComment).toMatch(`Maintainers,

As you review this RFC please queue up issues to be created using the following commands:

    queue-issue <repo> "<title>" [labels]...
    unqueue-issue <uid>

### Issues

  * ⬜️ 14b156 - org/repo1 "Issue 1"
  * ✅ d1dc9d - org/repo2#2 "Issue 2" [label-1]
`)
      })

      test('non-existent issue', function () {
        let [updatedComment, errors] = generateBotComment(
          [
            {
              uid: '14b156',
              repo: 'org/repo1',
              title: 'Issue 1',
              labels: []
            },
            {
              uid: 'd1dc9d',
              repo: 'org/repo2',
              title: 'Issue 2',
              labels: ['label-1']
            }
          ],
          [
            {
              op: 'creation',
              uid: 'non-existent',
              num: 2
            }
          ]
        )

        expect(errors).toHaveLength(1)
        expect(errors[0].message).toMatch(
          `Issue with uid 'non-existent' not found!`
        )
        expect(updatedComment).toMatch(`Maintainers,

As you review this RFC please queue up issues to be created using the following commands:

    queue-issue <repo> "<title>" [labels]...
    unqueue-issue <uid>

### Issues

  * ⬜️ 14b156 - org/repo1 "Issue 1"
  * ⬜️ d1dc9d - org/repo2 "Issue 2" [label-1]
`)
      })
    })
  })
})

describe('#extractIssuesFromBotComment', function () {
  test('extracts', function () {
    const issues = extractIssuesFromBotComment(`Maintainers,

As you review this RFC please queue up issues to be created using the following commands:

    queue-issue <repo> "<title>" [labels]...
    unqueue-issue <uid>

### Issues

  * ⬜️ 14b156 - org/repo1 "Issue 1"
  * ✅ d1dc9d - org/repo2#123 "Issue 2" [label-1]
  * ⬜️ cf07a9 - org/repo3 "Issue 3" [label-1][label 2]
`)

    expect(issues).toEqual([
      {
        uid: '14b156',
        repo: 'org/repo1',
        num: undefined,
        title: 'Issue 1',
        labels: []
      },
      {
        uid: 'd1dc9d',
        repo: 'org/repo2',
        num: 123,
        title: 'Issue 2',
        labels: ['label-1']
      },
      {
        uid: 'cf07a9',
        repo: 'org/repo3',
        num: undefined,
        title: 'Issue 3',
        labels: ['label-1', 'label 2']
      }
    ])
  })
})
