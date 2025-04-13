/**
 * ---------------------------------------------------------------------------------
 * This file has been generated by Sanity TypeGen.
 * Command: `sanity typegen generate`
 *
 * Any modifications made directly to this file will be overwritten the next time
 * the TypeScript definitions are generated. Please make changes to the Sanity
 * schema definitions and/or GROQ queries if you need to update these types.
 *
 * For more information on how to use Sanity TypeGen, visit the official documentation:
 * https://www.sanity.io/docs/sanity-typegen
 * ---------------------------------------------------------------------------------
 */

// Source: schema.json
export type SanityImagePaletteSwatch = {
  _type: "sanity.imagePaletteSwatch";
  background?: string;
  foreground?: string;
  population?: number;
  title?: string;
};

export type SanityImagePalette = {
  _type: "sanity.imagePalette";
  darkMuted?: SanityImagePaletteSwatch;
  lightVibrant?: SanityImagePaletteSwatch;
  darkVibrant?: SanityImagePaletteSwatch;
  vibrant?: SanityImagePaletteSwatch;
  dominant?: SanityImagePaletteSwatch;
  lightMuted?: SanityImagePaletteSwatch;
  muted?: SanityImagePaletteSwatch;
};

export type SanityImageDimensions = {
  _type: "sanity.imageDimensions";
  height?: number;
  width?: number;
  aspectRatio?: number;
};

export type SanityImageHotspot = {
  _type: "sanity.imageHotspot";
  x?: number;
  y?: number;
  height?: number;
  width?: number;
};

export type SanityImageCrop = {
  _type: "sanity.imageCrop";
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};

export type SanityImageAsset = {
  _id: string;
  _type: "sanity.imageAsset";
  _createdAt: string;
  _updatedAt: string;
  _rev: string;
  originalFilename?: string;
  label?: string;
  title?: string;
  description?: string;
  altText?: string;
  sha1hash?: string;
  extension?: string;
  mimeType?: string;
  size?: number;
  assetId?: string;
  uploadId?: string;
  path?: string;
  url?: string;
  metadata?: SanityImageMetadata;
  source?: SanityAssetSourceData;
};

export type SanityImageMetadata = {
  _type: "sanity.imageMetadata";
  location?: Geopoint;
  dimensions?: SanityImageDimensions;
  palette?: SanityImagePalette;
  lqip?: string;
  blurHash?: string;
  hasAlpha?: boolean;
  isOpaque?: boolean;
};

export type Geopoint = {
  _type: "geopoint";
  lat?: number;
  lng?: number;
  alt?: number;
};

export type Sponsor = {
  _id: string;
  _type: "sponsor";
  _createdAt: string;
  _updatedAt: string;
  _rev: string;
  title?: string;
  slug?: Slug;
  logo?: CloudinaryAsset;
  link?: string;
};

export type Person = {
  _id: string;
  _type: "person";
  _createdAt: string;
  _updatedAt: string;
  _rev: string;
  name?: string;
  slug?: Slug;
  photo?: CloudinaryAsset;
  bio?: string;
  links?: Array<{
    label?: string;
    url?: string;
    _type: "link";
    _key: string;
  }>;
  subscription?: {
    customer?: string;
    level?: string;
    status?: string;
    date?: string;
  };
  user_id?: string;
};

export type Episode = {
  _id: string;
  _type: "episode";
  _createdAt: string;
  _updatedAt: string;
  _rev: string;
  hidden?: boolean;
  title?: string;
  slug?: Slug;
  publish_date?: string;
  people?: Array<{
    _ref: string;
    _type: "reference";
    _weak?: boolean;
    _key: string;
    [internalGroqTypeReferenceTo]?: "person";
  }>;
  short_description?: string;
  description?: string;
  resources?: Array<{
    label?: string;
    url?: string;
    _type: "resource";
    _key: string;
  }>;
  sponsors?: Array<{
    _ref: string;
    _type: "reference";
    _weak?: boolean;
    _key: string;
    [internalGroqTypeReferenceTo]?: "sponsor";
  }>;
  video?: {
    members_only?: boolean;
    mux_video?: MuxVideo;
    captions?: {
      asset?: {
        _ref: string;
        _type: "reference";
        _weak?: boolean;
        [internalGroqTypeReferenceTo]?: "sanity.fileAsset";
      };
      _type: "file";
    };
    youtube_id?: string;
    thumbnail?: CloudinaryAsset;
    thumbnail_alt?: string;
    transcript?: string;
  };
};

export type SanityFileAsset = {
  _id: string;
  _type: "sanity.fileAsset";
  _createdAt: string;
  _updatedAt: string;
  _rev: string;
  originalFilename?: string;
  label?: string;
  title?: string;
  description?: string;
  altText?: string;
  sha1hash?: string;
  extension?: string;
  mimeType?: string;
  size?: number;
  assetId?: string;
  uploadId?: string;
  path?: string;
  url?: string;
  source?: SanityAssetSourceData;
};

export type SanityAssetSourceData = {
  _type: "sanity.assetSourceData";
  name?: string;
  id?: string;
  url?: string;
};

export type Collection = {
  _id: string;
  _type: "collection";
  _createdAt: string;
  _updatedAt: string;
  _rev: string;
  title?: string;
  slug?: Slug;
  release_year?: string;
  series?: {
    _ref: string;
    _type: "reference";
    _weak?: boolean;
    [internalGroqTypeReferenceTo]?: "series";
  };
  episodes?: Array<{
    _ref: string;
    _type: "reference";
    _weak?: boolean;
    _key: string;
    [internalGroqTypeReferenceTo]?: "episode";
  }>;
};

export type Series = {
  _id: string;
  _type: "series";
  _createdAt: string;
  _updatedAt: string;
  _rev: string;
  title?: string;
  slug?: Slug;
  collections?: Array<{
    _ref: string;
    _type: "reference";
    _weak?: boolean;
    _key: string;
    [internalGroqTypeReferenceTo]?: "collection";
  }>;
  image?: CloudinaryAsset;
  description?: string;
  sponsors?: Array<{
    _ref: string;
    _type: "reference";
    _weak?: boolean;
    _key: string;
    [internalGroqTypeReferenceTo]?: "sponsor";
  }>;
  featured?: boolean;
};

export type Slug = {
  _type: "slug";
  current?: string;
  source?: string;
};

export type MuxVideo = {
  _type: "mux.video";
  asset?: {
    _ref: string;
    _type: "reference";
    _weak?: boolean;
    [internalGroqTypeReferenceTo]?: "mux.videoAsset";
  };
};

export type MuxVideoAsset = {
  _type: "mux.videoAsset";
  status?: string;
  assetId?: string;
  playbackId?: string;
  filename?: string;
  thumbTime?: number;
  data?: MuxAssetData;
};

export type MuxAssetData = {
  _type: "mux.assetData";
  resolution_tier?: string;
  upload_id?: string;
  created_at?: string;
  id?: string;
  status?: string;
  max_stored_resolution?: string;
  passthrough?: string;
  encoding_tier?: string;
  master_access?: string;
  aspect_ratio?: string;
  duration?: number;
  max_stored_frame_rate?: number;
  mp4_support?: string;
  max_resolution_tier?: string;
  tracks?: Array<{
    _key: string;
  } & MuxTrack>;
  playback_ids?: Array<{
    _key: string;
  } & MuxPlaybackId>;
  static_renditions?: MuxStaticRenditions;
};

export type MuxStaticRenditions = {
  _type: "mux.staticRenditions";
  status?: string;
  files?: Array<{
    _key: string;
  } & MuxStaticRenditionFile>;
};

export type MuxStaticRenditionFile = {
  _type: "mux.staticRenditionFile";
  ext?: string;
  name?: string;
  width?: number;
  bitrate?: number;
  filesize?: number;
  height?: number;
};

export type MuxPlaybackId = {
  _type: "mux.playbackId";
  id?: string;
  policy?: string;
};

export type MuxTrack = {
  _type: "mux.track";
  id?: string;
  type?: string;
  max_width?: number;
  max_frame_rate?: number;
  duration?: number;
  max_height?: number;
};

export type CloudinaryAssetContextCustom = {
  _type: "cloudinary.assetContextCustom";
  alt?: string;
  caption?: string;
};

export type CloudinaryAssetDerived = {
  _type: "cloudinary.assetDerived";
  raw_transformation?: string;
  url?: string;
  secure_url?: string;
};

export type CloudinaryAsset = {
  _type: "cloudinary.asset";
  public_id?: string;
  resource_type?: string;
  type?: string;
  format?: string;
  version?: number;
  url?: string;
  secure_url?: string;
  width?: number;
  height?: number;
  bytes?: number;
  duration?: number;
  tags?: Array<string>;
  created_at?: string;
  derived?: Array<{
    _key: string;
  } & CloudinaryAssetDerived>;
  access_mode?: string;
  context?: CloudinaryAssetContext;
};

export type CloudinaryAssetContext = {
  _type: "cloudinary.assetContext";
  custom?: CloudinaryAssetContextCustom;
};

export type Markdown = string;

export type AllSanitySchemaTypes = SanityImagePaletteSwatch | SanityImagePalette | SanityImageDimensions | SanityImageHotspot | SanityImageCrop | SanityImageAsset | SanityImageMetadata | Geopoint | Sponsor | Person | Episode | SanityFileAsset | SanityAssetSourceData | Collection | Series | Slug | MuxVideo | MuxVideoAsset | MuxAssetData | MuxStaticRenditions | MuxStaticRenditionFile | MuxPlaybackId | MuxTrack | CloudinaryAssetContextCustom | CloudinaryAssetDerived | CloudinaryAsset | CloudinaryAssetContext | Markdown;
export declare const internalGroqTypeReferenceTo: unique symbol;
// Source: ../src/pages/api/sanity/generate-redirects.ts
// Variable: getEpisodeSlugQuery
// Query: *[_type == "collection" && series->slug.current == "learn-with-jason"] {    "newSlugBase": "/series/" + series->slug.current + "/" + slug.current,      episodes[]-> {        "oldSlug": "/" + slug.current      }  }
export type GetEpisodeSlugQueryResult = Array<{
  newSlugBase: string | null;
  episodes: Array<{
    oldSlug: string | null;
  }> | null;
}>;

// Source: ../src/pages/api/sanity/migrate.ts
// Variable: oldEpisodesQuery
// Query: *[_type == "episode" && date > $startDate && date < $endDate]{		...,		host->{				...,				guestImage{asset->},		},		guest[]->{				...,				guestImage{asset->},		},		episodeTags[],	} | order(date asc)[$startIndex...$endIndex]
export type OldEpisodesQueryResult = Array<{
  _id: string;
  _type: "episode";
  _createdAt: string;
  _updatedAt: string;
  _rev: string;
  hidden?: boolean;
  title?: string;
  slug?: Slug;
  publish_date?: string;
  people?: Array<{
    _ref: string;
    _type: "reference";
    _weak?: boolean;
    _key: string;
    [internalGroqTypeReferenceTo]?: "person";
  }>;
  short_description?: string;
  description?: string;
  resources?: Array<{
    label?: string;
    url?: string;
    _type: "resource";
    _key: string;
  }>;
  sponsors?: Array<{
    _ref: string;
    _type: "reference";
    _weak?: boolean;
    _key: string;
    [internalGroqTypeReferenceTo]?: "sponsor";
  }>;
  video?: {
    members_only?: boolean;
    mux_video?: MuxVideo;
    captions?: {
      asset?: {
        _ref: string;
        _type: "reference";
        _weak?: boolean;
        [internalGroqTypeReferenceTo]?: "sanity.fileAsset";
      };
      _type: "file";
    };
    youtube_id?: string;
    thumbnail?: CloudinaryAsset;
    thumbnail_alt?: string;
    transcript?: string;
  };
  host: null;
  guest: null;
  episodeTags: null;
}>;

// Source: ../src/util/sanity.ts
// Variable: allSeriesQuery
// Query: *[_type=="series"] {    title,    'slug': slug.current,    description,    image {      public_id,      height,      width,    },    "collections": collections[]->{      title,      'slug': slug.current,      release_year,      'episode_count': count(episodes[@->hidden != true && (defined(@->video.youtube_id) || defined(@->video.mux_video))])    } | order(release_year desc),    'total_episode_count': count(collections[]->episodes[@->hidden != true && (defined(@->video.youtube_id) || defined(@->video.mux_video))]),    'latestEpisodeDate': collections[]->episodes[@->hidden != true && (defined(@->video.youtube_id) || defined(@->video.mux_video))] | order(@->publish_date desc)[0]->publish_date,    featured  } | order(latestEpisodeDate desc)
export type AllSeriesQueryResult = Array<{
  title: string | null;
  slug: string | null;
  description: string | null;
  image: {
    public_id: string | null;
    height: number | null;
    width: number | null;
  } | null;
  collections: Array<{
    title: string | null;
    slug: string | null;
    release_year: string | null;
    episode_count: number | null;
  }> | null;
  total_episode_count: number | null;
  latestEpisodeDate: string | null;
  featured: boolean | null;
}>;
// Variable: seriesBySlugQuery
// Query: *[_type=="series" && slug.current==$series][0] {    title,    'slug': slug.current,    description,    image {      public_id,      height,      width,    },    'sponsors': sponsors[]->{      'title': title,      logo {        public_id,        width,        height      },      link,    },    'collection': collections[@->slug.current==$collection && @->series._ref==^._id][0]->{      title,      'slug': slug.current,      release_year,      episodes[@->hidden != true]->{        title,        'slug': slug.current,        short_description,        publish_date,        'thumbnail': {          'public_id': video.thumbnail.public_id,          'alt': video.thumbnail_alt,          'width': video.thumbnail.width,          'height': video.thumbnail.height,        },        video {          youtube_id,          mux_video,          members_only        }      }    },    collections[]->{      title,      'slug': slug.current,      release_year,      'episode_count': count(episodes[@->hidden != true])    }  }
export type SeriesBySlugQueryResult = {
  title: string | null;
  slug: string | null;
  description: string | null;
  image: {
    public_id: string | null;
    height: number | null;
    width: number | null;
  } | null;
  sponsors: Array<{
    title: string | null;
    logo: {
      public_id: string | null;
      width: number | null;
      height: number | null;
    } | null;
    link: string | null;
  }> | null;
  collection: {
    title: string | null;
    slug: string | null;
    release_year: string | null;
    episodes: Array<{
      title: string | null;
      slug: string | null;
      short_description: string | null;
      publish_date: string | null;
      thumbnail: {
        public_id: string | null;
        alt: string | null;
        width: number | null;
        height: number | null;
      };
      video: {
        youtube_id: string | null;
        mux_video: MuxVideo | null;
        members_only: boolean | null;
      } | null;
    }> | null;
  } | null;
  collections: Array<{
    title: string | null;
    slug: string | null;
    release_year: string | null;
    episode_count: number | null;
  }> | null;
} | null;
// Variable: allEpisodesQuery
// Query: *[_type=="episode" && hidden != true] {    title,    'slug': slug.current,    description,    short_description,    publish_date,    'thumbnail': {      'public_id': video.thumbnail.public_id,      'width': video.thumbnail.width,      'height': video.thumbnail.height,      'alt': video.thumbnail_alt,    },    video {      youtube_id,      'mux': mux_video.asset->data.playback_ids,      'captions': captions.asset->url,      transcript,    },    people[]-> {      user_id,      name,      "slug": slug.current,      photo {        public_id      }    },    resources[] {      label,      url,    },    'sponsors': sponsors[]->{      title,      logo {        public_id,        width,        height      },      link,    },    'related_episodes': *[_type=="collection" && references(^._id)][0].episodes[@->hidden != true && (defined(@->video.youtube_id) || defined(@->video.mux_video))]-> {      title,      'slug': slug.current,      short_description,      publish_date,      'thumbnail': {        'public_id': video.thumbnail.public_id,        'width': video.thumbnail.width,        'height': video.thumbnail.height,        'alt': video.thumbnail_alt,      },      video {        youtube_id      }    },    'collection': *[_type=="collection" && references(^._id)][0] {      'slug': slug.current,      title,      'episodeSlugs': episodes[]->slug.current,    },    'series': *[_type=="collection" && references(^._id)][0].series->{      'slug': slug.current,      title,    },  }
export type AllEpisodesQueryResult = Array<{
  title: string | null;
  slug: string | null;
  description: string | null;
  short_description: string | null;
  publish_date: string | null;
  thumbnail: {
    public_id: string | null;
    width: number | null;
    height: number | null;
    alt: string | null;
  };
  video: {
    youtube_id: string | null;
    mux: null;
    captions: string | null;
    transcript: string | null;
  } | null;
  people: Array<{
    user_id: string | null;
    name: string | null;
    slug: string | null;
    photo: {
      public_id: string | null;
    } | null;
  }> | null;
  resources: Array<{
    label: string | null;
    url: string | null;
  }> | null;
  sponsors: Array<{
    title: string | null;
    logo: {
      public_id: string | null;
      width: number | null;
      height: number | null;
    } | null;
    link: string | null;
  }> | null;
  related_episodes: Array<{
    title: string | null;
    slug: string | null;
    short_description: string | null;
    publish_date: string | null;
    thumbnail: {
      public_id: string | null;
      width: number | null;
      height: number | null;
      alt: string | null;
    };
    video: {
      youtube_id: string | null;
    } | null;
  }> | null;
  collection: {
    slug: string | null;
    title: string | null;
    episodeSlugs: Array<string | null> | null;
  } | null;
  series: {
    slug: string | null;
    title: string | null;
  } | null;
}>;
// Variable: episodeBySlugQuery
// Query: *[_type=="episode" && slug.current==$episode][0] {    title,    'slug': slug.current,    description,    short_description,    publish_date,    'thumbnail': {      'public_id': video.thumbnail.public_id,      'width': video.thumbnail.width,      'height': video.thumbnail.height,      'alt': video.thumbnail_alt,    },    video {      youtube_id,      'mux': mux_video.asset->data.playback_ids,      'captions': captions.asset->url,      transcript,    },    people[]-> {      user_id,      name,      "slug": slug.current,      photo {        public_id      }    },    resources[] {      label,      url,    },    'sponsors': sponsors[]->{      title,      logo {        public_id,        width,        height      },      link,    },    'related_episodes': *[_type=="collection" && references(^._id)][0].episodes[@->hidden != true && (defined(@->video.youtube_id) || defined(@->video.mux_video)) && @->title != ^.title]-> {      title,      'slug': slug.current,      short_description,      publish_date,      'thumbnail': {        'public_id': video.thumbnail.public_id,        'width': video.thumbnail.width,        'height': video.thumbnail.height,        'alt': video.thumbnail_alt,      },      video {        youtube_id      }    },    'collection': *[_type=="collection" && references(^._id)][0] {      'slug': slug.current,      title,      'episodeSlugs': episodes[]->slug.current,    },    'series': *[_type=="collection" && references(^._id)][0].series->{      'slug': slug.current,      title,    },  }
export type EpisodeBySlugQueryResult = {
  title: string | null;
  slug: string | null;
  description: string | null;
  short_description: string | null;
  publish_date: string | null;
  thumbnail: {
    public_id: string | null;
    width: number | null;
    height: number | null;
    alt: string | null;
  };
  video: {
    youtube_id: string | null;
    mux: null;
    captions: string | null;
    transcript: string | null;
  } | null;
  people: Array<{
    user_id: string | null;
    name: string | null;
    slug: string | null;
    photo: {
      public_id: string | null;
    } | null;
  }> | null;
  resources: Array<{
    label: string | null;
    url: string | null;
  }> | null;
  sponsors: Array<{
    title: string | null;
    logo: {
      public_id: string | null;
      width: number | null;
      height: number | null;
    } | null;
    link: string | null;
  }> | null;
  related_episodes: Array<{
    title: string | null;
    slug: string | null;
    short_description: string | null;
    publish_date: string | null;
    thumbnail: {
      public_id: string | null;
      width: number | null;
      height: number | null;
      alt: string | null;
    };
    video: {
      youtube_id: string | null;
    } | null;
  }> | null;
  collection: {
    slug: string | null;
    title: string | null;
    episodeSlugs: Array<string | null> | null;
  } | null;
  series: {
    slug: string | null;
    title: string | null;
  } | null;
} | null;
// Variable: episodeTranscriptBySlugQuery
// Query: *[_type=="episode" && slug.current==$episode][0].video.transcript
export type EpisodeTranscriptBySlugQueryResult = string | null;
// Variable: upcomingEpisodeBySeriesQuery
// Query: *[ _type == "collection" && series->slug.current == $seriesSlug] {    title,    "schedule": episodes[dateTime(@->publish_date) > dateTime(now()) && !defined(@->video.youtube_id) && !defined(@->video.mux_video) && @->hidden != true]-> {      title,      "slug": slug.current,      short_description,      publish_date,      "thumbnail": {        "src": video.thumbnail.public_id,        "alt": video.thumbnail_alt,      }    }  }
export type UpcomingEpisodeBySeriesQueryResult = Array<{
  title: string | null;
  schedule: Array<{
    title: string | null;
    slug: string | null;
    short_description: string | null;
    publish_date: string | null;
    thumbnail: {
      src: string | null;
      alt: string | null;
    };
  }> | null;
}>;
// Variable: personByIdQuery
// Query: *[_type == "person" && user_id == $user_id][0] {    _id,    name,    photo {      public_id,      height,      width,    },    bio,    links[],    user_id,    "episodes": *[_type == "episode" && hidden!=true && references(^._id) && (defined(@->video.youtube_id) || defined(@->video.mux_video))] {      title,      'slug': slug.current,      short_description,      publish_date,      'thumbnail': {        'public_id': video.thumbnail.public_id,        'alt': video.thumbnail_alt,        'width': video.thumbnail.width,        'height': video.thumbnail.height,      },      video {        youtube_id,      },      'collection': *[_type=="collection" && references(^._id)][0] {        'slug': slug.current,        title,        'episodeSlugs': episodes[]->slug.current,      },      'series': *[_type=="collection" && references(^._id)][0].series->{        'slug': slug.current,        title,      },    } | order(publish_date desc)[0...4]  }
export type PersonByIdQueryResult = {
  _id: string;
  name: string | null;
  photo: {
    public_id: string | null;
    height: number | null;
    width: number | null;
  } | null;
  bio: string | null;
  links: Array<{
    label?: string;
    url?: string;
    _type: "link";
    _key: string;
  }> | null;
  user_id: string | null;
  episodes: Array<never>;
} | null;
// Variable: personBySlugQuery
// Query: *[_type == "person" && slug.current == $slug][0] {    _id,    name,    "slug": slug.current,    photo {      public_id,      height,      width,    },    bio,    links[],    user_id,    "episodes": *[_type == "episode" && references(^._id) && hidden != true && (defined(video.youtube_id) || defined(video.mux_video))] {      title,      'slug': slug.current,      short_description,      publish_date,      'thumbnail': {        'public_id': video.thumbnail.public_id,        'alt': video.thumbnail_alt,        'width': video.thumbnail.width,        'height': video.thumbnail.height,      },      video {        youtube_id,      },      'collection': *[_type=="collection" && references(^._id)][0] {        'slug': slug.current,        title,        'episodeSlugs': episodes[]->slug.current,      },      'series': *[_type=="collection" && references(^._id)][0].series->{        'slug': slug.current,        title,      },    } | order(publish_date desc)[0...6]  }
export type PersonBySlugQueryResult = {
  _id: string;
  name: string | null;
  slug: string | null;
  photo: {
    public_id: string | null;
    height: number | null;
    width: number | null;
  } | null;
  bio: string | null;
  links: Array<{
    label?: string;
    url?: string;
    _type: "link";
    _key: string;
  }> | null;
  user_id: string | null;
  episodes: Array<{
    title: string | null;
    slug: string | null;
    short_description: string | null;
    publish_date: string | null;
    thumbnail: {
      public_id: string | null;
      alt: string | null;
      width: number | null;
      height: number | null;
    };
    video: {
      youtube_id: string | null;
    } | null;
    collection: {
      slug: string | null;
      title: string | null;
      episodeSlugs: Array<string | null> | null;
    } | null;
    series: {
      slug: string | null;
      title: string | null;
    } | null;
  }>;
} | null;
// Variable: personByClerkIdQuery
// Query: *[_type == "person" && user_id == $user_id][0] {    _id,    name,    slug,    user_id,  }
export type PersonByClerkIdQueryResult = {
  _id: string;
  name: string | null;
  slug: Slug | null;
  user_id: string | null;
} | null;
// Variable: supportersQuery
// Query: *[_type == "person" && subscription.status == "active"] {    _id,    name,    photo {      public_id,      height,      width,    },    'username': slug.current,    subscription {      level,      status    }  } | score(    boost(subscription.level match "Platinum", 3),    boost(subscription.level match "Gold", 2),    boost(subscription.level match "Silver", 1),  ) | order(_score desc)
export type SupportersQueryResult = Array<{
  _id: string;
  name: string | null;
  photo: {
    public_id: string | null;
    height: number | null;
    width: number | null;
  } | null;
  username: string | null;
  subscription: {
    level: string | null;
    status: string | null;
  } | null;
}>;

// Query TypeMap
import "@sanity/client";
declare module "@sanity/client" {
  interface SanityQueries {
    "\n  *[_type == \"collection\" && series->slug.current == \"learn-with-jason\"] {\n    \"newSlugBase\": \"/series/\" + series->slug.current + \"/\" + slug.current,\n      episodes[]-> {\n        \"oldSlug\": \"/\" + slug.current\n      }\n  }\n": GetEpisodeSlugQueryResult;
    "\n\t*[_type == \"episode\" && date > $startDate && date < $endDate]{\n\t\t...,\n\t\thost->{\n\t\t\t\t...,\n\t\t\t\tguestImage{asset->},\n\t\t},\n\t\tguest[]->{\n\t\t\t\t...,\n\t\t\t\tguestImage{asset->},\n\t\t},\n\t\tepisodeTags[],\n\t} | order(date asc)[$startIndex...$endIndex]\n": OldEpisodesQueryResult;
    "\n  *[_type==\"series\"] {\n    title,\n    'slug': slug.current,\n    description,\n    image {\n      public_id,\n      height,\n      width,\n    },\n    \"collections\": collections[]->{\n      title,\n      'slug': slug.current,\n      release_year,\n      'episode_count': count(episodes[@->hidden != true && (defined(@->video.youtube_id) || defined(@->video.mux_video))])\n    } | order(release_year desc),\n    'total_episode_count': count(collections[]->episodes[@->hidden != true && (defined(@->video.youtube_id) || defined(@->video.mux_video))]),\n    'latestEpisodeDate': collections[]->episodes[@->hidden != true && (defined(@->video.youtube_id) || defined(@->video.mux_video))] | order(@->publish_date desc)[0]->publish_date,\n    featured\n  } | order(latestEpisodeDate desc)\n": AllSeriesQueryResult;
    "\n  *[_type==\"series\" && slug.current==$series][0] {\n    title,\n    'slug': slug.current,\n    description,\n    image {\n      public_id,\n      height,\n      width,\n    },\n    'sponsors': sponsors[]->{\n      'title': title,\n      logo {\n        public_id,\n        width,\n        height\n      },\n      link,\n    },\n    'collection': collections[@->slug.current==$collection && @->series._ref==^._id][0]->{\n      title,\n      'slug': slug.current,\n      release_year,\n      episodes[@->hidden != true]->{\n        title,\n        'slug': slug.current,\n        short_description,\n        publish_date,\n        'thumbnail': {\n          'public_id': video.thumbnail.public_id,\n          'alt': video.thumbnail_alt,\n          'width': video.thumbnail.width,\n          'height': video.thumbnail.height,\n        },\n        video {\n          youtube_id,\n          mux_video,\n          members_only\n        }\n      }\n    },\n    collections[]->{\n      title,\n      'slug': slug.current,\n      release_year,\n      'episode_count': count(episodes[@->hidden != true])\n    }\n  }\n": SeriesBySlugQueryResult;
    "\n  *[_type==\"episode\" && hidden != true] {\n    title,\n    'slug': slug.current,\n    description,\n    short_description,\n    publish_date,\n    'thumbnail': {\n      'public_id': video.thumbnail.public_id,\n      'width': video.thumbnail.width,\n      'height': video.thumbnail.height,\n      'alt': video.thumbnail_alt,\n    },\n    video {\n      youtube_id,\n      'mux': mux_video.asset->data.playback_ids,\n      'captions': captions.asset->url,\n      transcript,\n    },\n    people[]-> {\n      user_id,\n      name,\n      \"slug\": slug.current,\n      photo {\n        public_id\n      }\n    },\n    resources[] {\n      label,\n      url,\n    },\n    'sponsors': sponsors[]->{\n      title,\n      logo {\n        public_id,\n        width,\n        height\n      },\n      link,\n    },\n    'related_episodes': *[_type==\"collection\" && references(^._id)][0].episodes[@->hidden != true && (defined(@->video.youtube_id) || defined(@->video.mux_video))]-> {\n      title,\n      'slug': slug.current,\n      short_description,\n      publish_date,\n      'thumbnail': {\n        'public_id': video.thumbnail.public_id,\n        'width': video.thumbnail.width,\n        'height': video.thumbnail.height,\n        'alt': video.thumbnail_alt,\n      },\n      video {\n        youtube_id\n      }\n    },\n    'collection': *[_type==\"collection\" && references(^._id)][0] {\n      'slug': slug.current,\n      title,\n      'episodeSlugs': episodes[]->slug.current,\n    },\n    'series': *[_type==\"collection\" && references(^._id)][0].series->{\n      'slug': slug.current,\n      title,\n    },\n  }\n": AllEpisodesQueryResult;
    "\n  *[_type==\"episode\" && slug.current==$episode][0] {\n    title,\n    'slug': slug.current,\n    description,\n    short_description,\n    publish_date,\n    'thumbnail': {\n      'public_id': video.thumbnail.public_id,\n      'width': video.thumbnail.width,\n      'height': video.thumbnail.height,\n      'alt': video.thumbnail_alt,\n    },\n    video {\n      youtube_id,\n      'mux': mux_video.asset->data.playback_ids,\n      'captions': captions.asset->url,\n      transcript,\n    },\n    people[]-> {\n      user_id,\n      name,\n      \"slug\": slug.current,\n      photo {\n        public_id\n      }\n    },\n    resources[] {\n      label,\n      url,\n    },\n    'sponsors': sponsors[]->{\n      title,\n      logo {\n        public_id,\n        width,\n        height\n      },\n      link,\n    },\n    'related_episodes': *[_type==\"collection\" && references(^._id)][0].episodes[@->hidden != true && (defined(@->video.youtube_id) || defined(@->video.mux_video)) && @->title != ^.title]-> {\n      title,\n      'slug': slug.current,\n      short_description,\n      publish_date,\n      'thumbnail': {\n        'public_id': video.thumbnail.public_id,\n        'width': video.thumbnail.width,\n        'height': video.thumbnail.height,\n        'alt': video.thumbnail_alt,\n      },\n      video {\n        youtube_id\n      }\n    },\n    'collection': *[_type==\"collection\" && references(^._id)][0] {\n      'slug': slug.current,\n      title,\n      'episodeSlugs': episodes[]->slug.current,\n    },\n    'series': *[_type==\"collection\" && references(^._id)][0].series->{\n      'slug': slug.current,\n      title,\n    },\n  }\n": EpisodeBySlugQueryResult;
    "\n  *[_type==\"episode\" && slug.current==$episode][0].video.transcript\n": EpisodeTranscriptBySlugQueryResult;
    "\n  *[ _type == \"collection\" && series->slug.current == $seriesSlug] {\n    title,\n    \"schedule\": episodes[dateTime(@->publish_date) > dateTime(now()) && !defined(@->video.youtube_id) && !defined(@->video.mux_video) && @->hidden != true]-> {\n      title,\n      \"slug\": slug.current,\n      short_description,\n      publish_date,\n      \"thumbnail\": {\n        \"src\": video.thumbnail.public_id,\n        \"alt\": video.thumbnail_alt,\n      }\n    }\n  }\n": UpcomingEpisodeBySeriesQueryResult;
    "\n  *[_type == \"person\" && user_id == $user_id][0] {\n    _id,\n    name,\n    photo {\n      public_id,\n      height,\n      width,\n    },\n    bio,\n    links[],\n    user_id,\n    \"episodes\": *[_type == \"episode\" && hidden!=true && references(^._id) && (defined(@->video.youtube_id) || defined(@->video.mux_video))] {\n      title,\n      'slug': slug.current,\n      short_description,\n      publish_date,\n      'thumbnail': {\n        'public_id': video.thumbnail.public_id,\n        'alt': video.thumbnail_alt,\n        'width': video.thumbnail.width,\n        'height': video.thumbnail.height,\n      },\n      video {\n        youtube_id,\n      },\n      'collection': *[_type==\"collection\" && references(^._id)][0] {\n        'slug': slug.current,\n        title,\n        'episodeSlugs': episodes[]->slug.current,\n      },\n      'series': *[_type==\"collection\" && references(^._id)][0].series->{\n        'slug': slug.current,\n        title,\n      },\n    } | order(publish_date desc)[0...4]\n  }\n": PersonByIdQueryResult;
    "\n  *[_type == \"person\" && slug.current == $slug][0] {\n    _id,\n    name,\n    \"slug\": slug.current,\n    photo {\n      public_id,\n      height,\n      width,\n    },\n    bio,\n    links[],\n    user_id,\n    \"episodes\": *[_type == \"episode\" && references(^._id) && hidden != true && (defined(video.youtube_id) || defined(video.mux_video))] {\n      title,\n      'slug': slug.current,\n      short_description,\n      publish_date,\n      'thumbnail': {\n        'public_id': video.thumbnail.public_id,\n        'alt': video.thumbnail_alt,\n        'width': video.thumbnail.width,\n        'height': video.thumbnail.height,\n      },\n      video {\n        youtube_id,\n      },\n      'collection': *[_type==\"collection\" && references(^._id)][0] {\n        'slug': slug.current,\n        title,\n        'episodeSlugs': episodes[]->slug.current,\n      },\n      'series': *[_type==\"collection\" && references(^._id)][0].series->{\n        'slug': slug.current,\n        title,\n      },\n    } | order(publish_date desc)[0...6]\n  }\n": PersonBySlugQueryResult;
    "\n  *[_type == \"person\" && user_id == $user_id][0] {\n    _id,\n    name,\n    slug,\n    user_id,\n  }\n": PersonByClerkIdQueryResult;
    "\n  *[_type == \"person\" && subscription.status == \"active\"] {\n    _id,\n    name,\n    photo {\n      public_id,\n      height,\n      width,\n    },\n    'username': slug.current,\n    subscription {\n      level,\n      status\n    }\n  } | score(\n    boost(subscription.level match \"Platinum\", 3),\n    boost(subscription.level match \"Gold\", 2),\n    boost(subscription.level match \"Silver\", 1),\n  ) | order(_score desc)\n": SupportersQueryResult;
  }
}
