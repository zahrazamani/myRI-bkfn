// This file acts as a simulated, pre-computed vector database.
// In a real-world application, this data would live in a specialized vector database
// and be queried via a backend API.
// The embeddings have been pre-generated using a text embedding model.

interface VectorDBEntry {
  chunk: string;
  embedding: number[];
  source: string;
}

// NOTE: For brevity, only a small, representative subset of the vectors for the entire
// knowledge base is included here. A full vectorization would result in a very large file.
// The principle remains the same. The embeddings below are illustrative placeholders.

export const vectorDB: VectorDBEntry[] = [
  {
    chunk: `Part 1: Fate and Destiny are the Words that Cause Alarm. No two words more awful than fate and destiny have ever struck the ears of a human being. Nothing can be more depressing to the spirit of a man than the feeling that he has no liberty and all his acts are controlled by a superpower. It may be said that freedom and liberty are the supreme blessings and the most bitter disappointment is a feeling of helplessness, a feeling that one has no independent personality, a feeling that he is just like a sheep in the hands of a shepherd and that he has no control even over his food, sleep, life and death.`,
    embedding: [-0.01, 0.02, 0.05, -0.04, 0.03, 0.06, -0.02, 0.01, -0.05, 0.04],
    source: "Man and His Destiny, Part 1"
  },
  {
    chunk: `The question of fate and destiny is one of the most equivocal philosophical questions. For certain reasons to be explained later, it has been a subject of dispute among the Muslim thinkers from the first century of the Hijri era. The various views held in this connection have caused many controversies and given rise to a number of sects in the Muslim world with queer results during the past fourteen centuries. Though it is a so called metaphysical subject, for two reasons it also comes under the category or practical and social questions. The first reason is that man's way of thinking about this question affects his practical life and social attitude.`,
    embedding: [0.03, -0.01, 0.06, 0.02, -0.05, 0.01, 0.04, -0.03, 0.02, -0.06],
    source: "Man and His Destiny, Part 1"
  },
  {
    chunk: `Verses of The Qur'an. Some verses of the Holy Qur'an expressly support the rule of destiny. They state that nothing happens in the world without the Will of Allah and that every event is already recorded in the ‘Book'. "Every affliction that falls on the earth or yourselves, already exists in a Book before it is brought into being by us. No doubt that is easy for Allah to accomplish”. (Surah al-Hadid, 57:22). There are other verses which indicate that man is free and he can change his destiny: “Allah never changes the condition of a nation unless it change what is in its heart”. (Surah al-Ra'd, 13:11)`,
    embedding: [0.05, 0.01, -0.03, 0.06, 0.02, -0.01, 0.05, -0.04, 0.01, 0.03],
    source: "Man and His Destiny, Verses of The Qur'an"
  },
  {
    chunk: `Predestination. From the foregoing discussion it is clear that a belief in fate and destiny and that every event, including human deeds and acts, is determined by Divine decrees, does not necessarily mean predestination. It would have certainly meant so, had we believed that man and his will have no role in this respect. As hinted earlier, the Divine Being does not influence the events of the world direct. That is absolutely impossible. He necessitates the existence of a thing through its particular causes only. That everything is decreed by Allah simply means that the system of causation is subject to His Will and Knowledge.`,
    embedding: [-0.04, 0.06, 0.01, -0.02, 0.05, 0.03, -0.01, 0.02, -0.06, 0.05],
    source: "Man and His Destiny, Predestination"
  },
  {
    chunk: `PART III:ISLAMIC BELIEFS FROM THE SHI'ITE POINT OF VILW. IV. On the Knowledge of God. The World Seen from the Point of View of Being and Reality ; The Necessity of God. Consciousness and perception, which are intertwined with man's very being, make evident by their very nature the existence of God as well as the world. For, contrary to those who express doubt about their own existence and everything else and consider the world as illusion and fantasy, we know that a human being at the moment of his coming into existence, when he is already conscious and possesses perception, discovers himself and the world.`,
    embedding: [0.06, 0.03, -0.04, 0.01, 0.05, -0.02, 0.03, 0.01, -0.05, -0.01],
    source: "Shi'a, Part III, Chapter IV"
  },
  {
    chunk: `Man and Free Will. The action which man performs is one of the phenomena of the world of creation and its appearance depends, completely, like other phenomena in the world, upon its cause. And since man in a part of the world of creation and has an ontological relation with other parts of the cosmos, we cannot accept the premise that other parts should not have an effect upon his actions. Man's simple and untainted comprehension also confirms this point of view, for we see that people through their God-given nature and intelligence distinguish between such things as eating, drinking, coming and going on the one hand, and on the other, such things as health and illness, age and youth or the height of the body. The first group, which is directly related to man's will, is considered to be performed according to the free choice of the individual so that people command and prohibit them and blame or condemn them.`,
    embedding: [-0.05, 0.01, 0.04, -0.03, 0.02, 0.06, 0.01, -0.02, 0.04, -0.05],
    source: "Shi'a, Part III, Chapter IV"
  }
];