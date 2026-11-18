# DSA patterns

Pick one name from this list for the **DSA** section of a dry run, or write `**Chosen:** none`. Copy links from here only. Never write a link from memory.

Each entry: when to use it, typical Big-O, and 3 verified LeetCode links as `title · difficulty · URL`.

### Hash map / set lookup
- Use when: Need O(1) membership, counting or pairing instead of nested loops.
- Big-O: O(n) time, O(n) space.
- Two Sum · Easy · https://leetcode.com/problems/two-sum/
- Longest Consecutive Sequence · Medium · https://leetcode.com/problems/longest-consecutive-sequence/
- Max Points on a Line · Hard · https://leetcode.com/problems/max-points-on-a-line/

### Two pointers
- Use when: Sorted or symmetric data, or a pair scan from both ends.
- Big-O: O(n) time, O(1) space (add O(n log n) if you sort first).
- Valid Palindrome · Easy · https://leetcode.com/problems/valid-palindrome/
- 3Sum · Medium · https://leetcode.com/problems/3sum/
- Trapping Rain Water · Hard · https://leetcode.com/problems/trapping-rain-water/

### Sliding window
- Use when: A contiguous subarray or substring with a size or validity rule.
- Big-O: O(n) time, O(k) space for a window of k.
- Best Time to Buy and Sell Stock · Easy · https://leetcode.com/problems/best-time-to-buy-and-sell-stock/
- Longest Substring Without Repeating Characters · Medium · https://leetcode.com/problems/longest-substring-without-repeating-characters/
- Minimum Window Substring · Hard · https://leetcode.com/problems/minimum-window-substring/

### Prefix sum
- Use when: Many range-sum queries, or a subarray-sum condition.
- Big-O: O(n) build, O(1) per query, O(n) space.
- Range Sum Query - Immutable · Easy · https://leetcode.com/problems/range-sum-query-immutable/
- Subarray Sum Equals K · Medium · https://leetcode.com/problems/subarray-sum-equals-k/
- Count of Range Sum · Hard · https://leetcode.com/problems/count-of-range-sum/

### Stack
- Use when: Nested or last-in-first-out work: brackets, undo, expression evaluation.
- Big-O: O(n) time, O(n) space.
- Valid Parentheses · Easy · https://leetcode.com/problems/valid-parentheses/
- Evaluate Reverse Polish Notation · Medium · https://leetcode.com/problems/evaluate-reverse-polish-notation/
- Basic Calculator · Hard · https://leetcode.com/problems/basic-calculator/

### Monotonic stack
- Use when: Next greater or smaller element, or left/right bounds for each item.
- Big-O: O(n) time (each item pushed and popped once), O(n) space.
- Next Greater Element I · Easy · https://leetcode.com/problems/next-greater-element-i/
- Daily Temperatures · Medium · https://leetcode.com/problems/daily-temperatures/
- Largest Rectangle in Histogram · Hard · https://leetcode.com/problems/largest-rectangle-in-histogram/

### Queue / BFS
- Use when: Shortest path in an unweighted graph or grid, or level-by-level work.
- Big-O: O(V+E) time, O(V) space.
- Implement Queue using Stacks · Easy · https://leetcode.com/problems/implement-queue-using-stacks/
- Rotting Oranges · Medium · https://leetcode.com/problems/rotting-oranges/
- Word Ladder · Hard · https://leetcode.com/problems/word-ladder/

### DFS / recursion
- Use when: Explore every path, tree or grid region, or any recursive structure.
- Big-O: O(V+E) time (a tree is O(n)), O(depth) stack space.
- Maximum Depth of Binary Tree · Easy · https://leetcode.com/problems/maximum-depth-of-binary-tree/
- Number of Islands · Medium · https://leetcode.com/problems/number-of-islands/
- Longest Increasing Path in a Matrix · Hard · https://leetcode.com/problems/longest-increasing-path-in-a-matrix/

### Binary search
- Use when: Sorted data, or a yes/no answer that flips once as the input grows.
- Big-O: O(log n) time, O(1) space.
- Binary Search · Easy · https://leetcode.com/problems/binary-search/
- Search in Rotated Sorted Array · Medium · https://leetcode.com/problems/search-in-rotated-sorted-array/
- Median of Two Sorted Arrays · Hard · https://leetcode.com/problems/median-of-two-sorted-arrays/

### Sorting + custom comparator
- Use when: Order by a derived or multi-part key, or sorting makes the answer easy.
- Big-O: O(n log n) time, O(n) space.
- Sort the People · Easy · https://leetcode.com/problems/sort-the-people/
- Largest Number · Medium · https://leetcode.com/problems/largest-number/
- Maximum Profit in Job Scheduling · Hard · https://leetcode.com/problems/maximum-profit-in-job-scheduling/

### Heap / top-K
- Use when: Need the k best items, a running min or max, or a median of a stream.
- Big-O: O(n log k) time, O(k) space.
- Kth Largest Element in a Stream · Easy · https://leetcode.com/problems/kth-largest-element-in-a-stream/
- Top K Frequent Elements · Medium · https://leetcode.com/problems/top-k-frequent-elements/
- Find Median from Data Stream · Hard · https://leetcode.com/problems/find-median-from-data-stream/

### Intervals (merge / overlap)
- Use when: Merge, overlap or schedule ranges.
- Big-O: O(n log n) time for the sort, O(n) space.
- Summary Ranges · Easy · https://leetcode.com/problems/summary-ranges/
- Merge Intervals · Medium · https://leetcode.com/problems/merge-intervals/
- Data Stream as Disjoint Intervals · Hard · https://leetcode.com/problems/data-stream-as-disjoint-intervals/

### Graph topological sort
- Use when: Order tasks that depend on each other (a DAG), like pipeline steps.
- Big-O: O(V+E) time, O(V+E) space.
- Find the Town Judge · Easy · https://leetcode.com/problems/find-the-town-judge/
- Course Schedule II · Medium · https://leetcode.com/problems/course-schedule-ii/
- Parallel Courses III · Hard · https://leetcode.com/problems/parallel-courses-iii/

### Union-find
- Use when: Group items by connection, merge groups as data arrives, entity resolution.
- Big-O: About O(n) time with path compression (O(n·α(n)) exactly), O(n) space.
- Find if Path Exists in Graph · Easy · https://leetcode.com/problems/find-if-path-exists-in-graph/
- Accounts Merge · Medium · https://leetcode.com/problems/accounts-merge/
- Number of Good Paths · Hard · https://leetcode.com/problems/number-of-good-paths/

### Trie
- Use when: Many prefix lookups over a set of strings.
- Big-O: O(L) per insert or search (L = word length), O(total characters) space.
- Longest Common Prefix · Easy · https://leetcode.com/problems/longest-common-prefix/
- Implement Trie (Prefix Tree) · Medium · https://leetcode.com/problems/implement-trie-prefix-tree/
- Word Search II · Hard · https://leetcode.com/problems/word-search-ii/

### Dynamic programming (1D)
- Use when: Overlapping subproblems that depend on one changing index.
- Big-O: O(n) to O(n·k) time, O(n) space (often O(1) with rolling values).
- Climbing Stairs · Easy · https://leetcode.com/problems/climbing-stairs/
- Coin Change · Medium · https://leetcode.com/problems/coin-change/
- Longest Valid Parentheses · Hard · https://leetcode.com/problems/longest-valid-parentheses/

### Dynamic programming (2D)
- Use when: Overlapping subproblems over two sequences or a grid.
- Big-O: O(n·m) time, O(n·m) space (O(m) with a rolling row).
- Pascal's Triangle · Easy · https://leetcode.com/problems/pascals-triangle/
- Longest Common Subsequence · Medium · https://leetcode.com/problems/longest-common-subsequence/
- Distinct Subsequences · Hard · https://leetcode.com/problems/distinct-subsequences/

### Greedy
- Use when: A local best choice is provably the global best, often after a sort.
- Big-O: O(n log n) time with the sort, O(1) extra space.
- Assign Cookies · Easy · https://leetcode.com/problems/assign-cookies/
- Jump Game · Medium · https://leetcode.com/problems/jump-game/
- Candy · Hard · https://leetcode.com/problems/candy/

### Backtracking
- Use when: List all combinations, permutations or placements, with pruning.
- Big-O: O(2^n) to O(n!) time, O(n) recursion space.
- Binary Tree Paths · Easy · https://leetcode.com/problems/binary-tree-paths/
- Subsets · Medium · https://leetcode.com/problems/subsets/
- N-Queens · Hard · https://leetcode.com/problems/n-queens/

### Linked list
- Use when: Pointer rewiring or fast/slow pointers; no random access.
- Big-O: O(n) time, O(1) space.
- Reverse Linked List · Easy · https://leetcode.com/problems/reverse-linked-list/
- Reorder List · Medium · https://leetcode.com/problems/reorder-list/
- Reverse Nodes in k-Group · Hard · https://leetcode.com/problems/reverse-nodes-in-k-group/

### Tree traversal
- Use when: Visit nodes in a set order, carrying state down or up.
- Big-O: O(n) time, O(h) space for height h.
- Binary Tree Inorder Traversal · Easy · https://leetcode.com/problems/binary-tree-inorder-traversal/
- Validate Binary Search Tree · Medium · https://leetcode.com/problems/validate-binary-search-tree/
- Serialize and Deserialize Binary Tree · Hard · https://leetcode.com/problems/serialize-and-deserialize-binary-tree/

### LRU cache / design
- Use when: O(1) get and put with an eviction order.
- Big-O: O(1) per operation, O(capacity) space.
- Design HashMap · Easy · https://leetcode.com/problems/design-hashmap/
- LRU Cache · Medium · https://leetcode.com/problems/lru-cache/
- LFU Cache · Hard · https://leetcode.com/problems/lfu-cache/

### Dedup by key (DE)
- Use when: Drop repeated records by a key, maybe only within a window.
- Big-O: O(n) time, O(n) space (O(window) if bounded).
- Contains Duplicate II · Easy · https://leetcode.com/problems/contains-duplicate-ii/
- Find Duplicate Subtrees · Medium · https://leetcode.com/problems/find-duplicate-subtrees/
- Contains Duplicate III · Hard · https://leetcode.com/problems/contains-duplicate-iii/

### Group-by / bucketing (DE)
- Use when: Collect items under a derived key, like SQL GROUP BY.
- Big-O: O(n) time, O(n) space.
- First Unique Character in a String · Easy · https://leetcode.com/problems/first-unique-character-in-a-string/
- Group Anagrams · Medium · https://leetcode.com/problems/group-anagrams/
- Maximum Gap · Medium · https://leetcode.com/problems/maximum-gap/

### Set difference (schema diff) (DE)
- Use when: Compare two key sets: columns, schemas or id lists.
- Big-O: O(n+m) time, O(n+m) space.
- Find the Difference of Two Arrays · Easy · https://leetcode.com/problems/find-the-difference-of-two-arrays/
- Intersection of Two Arrays · Easy · https://leetcode.com/problems/intersection-of-two-arrays/
- First Missing Positive · Hard · https://leetcode.com/problems/first-missing-positive/

### Streaming / batching (chunking) (DE)
- Use when: Split input into fixed-size or capacity-bound chunks.
- Big-O: O(n) time, O(batch size) space.
- Divide a String Into Groups of Size k · Easy · https://leetcode.com/problems/divide-a-string-into-groups-of-size-k/
- Hand of Straights · Medium · https://leetcode.com/problems/hand-of-straights/
- Text Justification · Hard · https://leetcode.com/problems/text-justification/

### Stable merge of sorted lists (DE)
- Use when: Combine sorted inputs and keep the original order on ties.
- Big-O: O(n) for two lists, O(n log k) for k lists; O(1) or O(k) extra space.
- Merge Two Sorted Lists · Easy · https://leetcode.com/problems/merge-two-sorted-lists/
- Sort List · Medium · https://leetcode.com/problems/sort-list/
- Merge k Sorted Lists · Hard · https://leetcode.com/problems/merge-k-sorted-lists/
