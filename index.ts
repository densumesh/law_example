import { sleep } from "bun";

const secure_the_border_act_path = "./secure_the_border_act.txt";
const tax_relief_act_path = "./tax_relief_for_american_families_act.txt";

/// Here are two bills that we want to upload to Trieve
const bills = [
  await Bun.file(secure_the_border_act_path).text(),
  await Bun.file(tax_relief_act_path).text(),
];

const api_key = "tr-*****************";
const dataset_id = "**************************";

// We can upload these bills to Trieve using the `upload` method
// We can use two upload strategies: split_avg and chunking

// Let's first upload the bills using the split_avg strategy
// This strategy will keep all of the parts of the bill together, but split them into chunks on our end and avergae the vector, allowing the
// bill to be kept together instead of seperating it into chunks
for (const bill in bills) {
  await fetch("https://api.trieve.ai/api/chunk", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: api_key,
      "TR-Dataset": dataset_id,
    },
    body: JSON.stringify({
      chunk_html: bills[bill],
      time_stamp: "2024-02-03",
      tag_set: ["Any tags you want to assoicate with this bill"],
      link: "link to this bill",
      //any other metadata you nwant to include with the bill and be able to filter by
      metadata: {
        states: ["AZ", "TN"],
      },
      tracking_id: bill.toString(),
      split_avg: true,
    }),
  }).then((response) => response.json());
}

console.log(
  "waiting for ingestion microservice to fully ingest the bills.... You can track this in the events tab in the Trieve dashboard or use the api (https://api.trieve.ai/api/events)",
);
await sleep(5000);

/// Now let's search with some filters
await fetch("https://api.trieve.ai/api/chunk/search", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: api_key,
    "TR-Dataset": dataset_id,
  },
  body: JSON.stringify({
    query: "border",
    search_type: "hybrid",
    // You can filter by metadata fields to only get bills that match the filter
    // You can have must, must_not, and should filters
    // All must filters must be true for the bill to be returned
    // Any must_not filters must be false for the bill to be returned
    // Any should filters can be true for the bill to be returned
    filters: {
      must: [
        {
          field: "metadata.states",
          value: ["AZ"],
        },
      ],
    },
  }),
})
  .then((response) => response.json())
  .then((data) => console.log(data));

//Now lets get some recommendations
await fetch("https://api.trieve.ai/api/chunk/recommend", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: api_key,
    "TR-Dataset": dataset_id,
  },
  body: JSON.stringify({
    // You can specifcy bills you want to see similar bills to using the ids in your system
    positive_tracking_ids: ["0"],
    // You can also specify bills you want to see dissimilar bills to using the ids in your system
    // negative_tracking_ids: ["1"],
  }),
})
  .then((response) => response.json())
  .then((data) => console.log(data));

//Now let's delete the bills and try with a new strategy
for (const bill in bills) {
  await fetch(
    "https://api.trieve.ai/api/chunk/tracking_id/" + bill.toString(),
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: api_key,
        "TR-Dataset": dataset_id,
      },
    },
  );
}

function splitIntoChunks(str: String, maxWords: number) {
  const words = str.split(" "); // Split string into words
  const chunks = [];
  let currentChunk: String[] = [];

  words.forEach((word) => {
    if (currentChunk.length < maxWords) {
      currentChunk.push(word);
    } else {
      chunks.push(currentChunk.join(" ")); // Join the words back into a string
      currentChunk = [word]; // Start a new chunk with the current word
    }
  });

  // Don't forget to add the last chunk if it's not empty
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" "));
  }

  return chunks;
}
// Now let's upload the bills using the chunking strategy
// This strategy will split the bill into chunks and upload them individually
for (const bill in bills) {
  const chunks = splitIntoChunks(bills[bill], 500); // Split the bill into chunks of 500 words
  // Create a group for the bill, so that we can put all of the chunks in the group
  await fetch("https://api.trieve.ai/api/chunk_group", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: api_key,
      "TR-Dataset": dataset_id,
    },
    body: JSON.stringify({
      name: "Name of the bill",
      description: "Description of the bill",
      tracking_id: bill.toString(),
    }),
  })
    .then((response) => response.json())
    .then((data) => console.log(data));

  console.log(chunks.length);

  chunks.forEach(async (chunk) => {
    await fetch("https://api.trieve.ai/api/chunk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: api_key,
        "TR-Dataset": dataset_id,
      },
      body: JSON.stringify({
        chunk_html: chunk,
        time_stamp: "2024-02-03",
        tag_set: ["Any tags you want to assoicate with this bill"],
        link: "link to this bill",
        //any other metadata you nwant to include with the bill and be able to filter by
        metadata: {
          states: ["AZ", "TN"],
        },
        group_tracking_ids: [bill.toString()],
      }),
    }).then((response) => response.json());
    //   .then((data) => console.log(data));
  });
}

await sleep(10000);

// Now let's search with some filters
// group oriented search lets you search over groups so that the results are the groups that match the search rather than individual chunks
await fetch("https://api.trieve.ai/api/chunk_group/group_oriented_search", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: api_key,
    "TR-Dataset": dataset_id,
  },
  body: JSON.stringify({
    query: "border",
    search_type: "hybrid",
    filters: {
      must: [
        {
          field: "metadata.states",
          value: ["AZ"],
        },
      ],
    },
  }),
})
  .then((response) => response.json())
  .then((data) => console.log(data));

//Now lets get some reccomendations
await fetch("https://api.trieve.ai/api/chunk_group/recommend", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: api_key,
    "TR-Dataset": dataset_id,
  },
  body: JSON.stringify({
    // You can specifcy bills you want to see similar bills to using the ids in your system
    positive_group_tracking_ids: ["0"],
    // You can also specify bills you want to see dissimilar bills to using the ids in your system
    // negative_group_tracking_ids: ["1"],
  }),
})
  .then((response) => response.json())
  .then((data) => console.log(data));
