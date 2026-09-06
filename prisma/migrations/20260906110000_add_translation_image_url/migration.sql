-- Photo translation turns carry a composed result image (original text
-- erased, translation drawn in). The JPEG lives on the app's disk under
-- var/translated/<topicId>/<translationId>.jpg; imageUrl stores the relative
-- API path that serves it back.
ALTER TABLE "translations" ADD COLUMN "imageUrl" TEXT;
